import { TweetV2, TweetV2SingleResult } from "twitter-api-v2";
import { extractUrls, imageUrlToBuffer } from "../../agents/utils.js";
import { TweetV2WithURLs } from "../../agents/curate-data/types.js";

/**
 * Generates a link to a tweet based on its author ID and tweet ID.
 * @param authorId The ID of the author of the tweet
 * @param tweetId The ID of the tweet
 * @returns The link to the tweet
 */
export function getTweetLink(authorId: string, tweetId: string): string {
  return `https://twitter.com/${authorId}/status/${tweetId}`;
}

/**
 * Resolves a shortened Twitter URL to the original URL.
 * This is because Twitter shortens URLs in tweets and makes
 * you follow a redirect to get the original URL.
 * @param shortUrl The shortened Twitter URL
 * @returns The resolved Twitter URL
 */
export async function resolveTwitterUrl(
  shortUrl: string,
): Promise<string | undefined> {
  try {
    const response = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "follow",
    });
    return response.url;
  } catch (error) {
    console.warn(`Failed to resolve Twitter URL ${shortUrl}:`, error);
    return undefined;
  }
}

/**
 * Resolves and replaces shortened Twitter URLs in a tweet's text content.
 * @param content The text content of the tweet
 * @returns The text content with shortened Twitter URLs replaced
 */
export async function resolveAndReplaceTweetTextLinks(
  content: string,
): Promise<{
  content: string;
  externalUrls: string[];
}> {
  const urlsInTweet = extractUrls(content);
  if (!urlsInTweet) {
    console.warn("No URLs found in tweet content:", content);
    return { content, externalUrls: [] };
  }

  const cleanedUrls = (
    await Promise.all(
      urlsInTweet.map(async (url) => {
        if (
          !url.includes("https://t.co") &&
          !url.includes("https://x.com") &&
          !url.includes("https://twitter.com")
        ) {
          return {
            original: url,
            resolved: undefined,
          };
        }
        const resolvedUrl = await resolveTwitterUrl(url);
        if (
          !resolvedUrl ||
          resolvedUrl.includes("https://t.co") ||
          resolvedUrl.includes("https://twitter.com") ||
          resolvedUrl.includes("https://x.com")
        ) {
          // Do not return twitter URLs.
          return {
            original: url,
            resolved: undefined,
          };
        }
        return {
          original: url,
          resolved: resolvedUrl,
        };
      }),
    )
  ).flat();

  let updatedContent = content;
  for (const urlPair of cleanedUrls) {
    if (urlPair.resolved) {
      updatedContent = updatedContent.replaceAll(
        urlPair.original,
        urlPair.resolved,
      );
    }
  }

  const externalUrlsSet = new Set(
    cleanedUrls
      .filter(
        (url): url is { resolved: string; original: string } => !!url.resolved,
      )
      .map((url) => url.resolved),
  );

  return {
    content: updatedContent,
    externalUrls: Array.from(externalUrlsSet),
  };
}

/**
 * Processes an array of tweets and resolves any shortened URLs in their text content.
 * For each tweet, it extracts URLs from both regular text and note_tweet text (if present),
 * resolves them to their full form, and adds them to the tweet object.
 *
 * @param {TweetV2[]} tweets - An array of Twitter V2 API tweet objects to process
 * @returns {Promise<TweetV2WithURLs[]>} A promise that resolves to an array of processed tweets.
 *                                       Each tweet will have an additional `external_urls` field
 *                                       containing an array of resolved URLs found in the tweet's text.
 *
 * @example
 * const tweets = await client.getTweets();
 * const processedTweets = await resolveTweetsWithUrls(tweets);
 * // Each tweet in processedTweets will have resolved URLs in external_urls field
 */
export async function resolveTweetsWithUrls(
  tweets: TweetV2[],
): Promise<TweetV2WithURLs[]> {
  const resolvedTweets: TweetV2WithURLs[] = [];

  for (const tweet of tweets) {
    const tweetText = tweet.note_tweet?.text || tweet.text || "";
    if (!tweetText) {
      continue;
    }

    const contentAndUrls = await resolveAndReplaceTweetTextLinks(tweetText);

    if (tweet.note_tweet?.text) {
      resolvedTweets.push({
        ...tweet,
        note_tweet: {
          ...tweet.note_tweet,
          text: contentAndUrls.content,
        },
        external_urls: contentAndUrls.externalUrls,
      });
    } else {
      if (tweet.note_tweet?.text) {
        resolvedTweets.push({
          ...tweet,
          text: contentAndUrls.content,
          external_urls: contentAndUrls.externalUrls,
        });
      }
    }
  }

  return resolvedTweets;
}

/**
 * Combines the text content of a parent tweet and its thread replies into a single string.
 * For both parent tweet and replies, it checks for and uses note_tweet text if available,
 * otherwise falls back to regular text content.
 *
 * @param parentTweet - The parent tweet object containing the initial tweet's data
 * @param threadReplies - An array of reply tweets that form the thread
 * @returns A string containing the combined text of the parent tweet and all replies,
 *          separated by newlines
 */
export function getFullThreadText(
  parentTweet: TweetV2SingleResult,
  threadReplies: TweetV2[],
): string {
  let tweetContentText = "";

  if (parentTweet.data.note_tweet?.text) {
    tweetContentText = parentTweet.data.note_tweet.text;
  } else {
    tweetContentText = parentTweet.data.text;
  }

  threadReplies.forEach((r) => {
    if (r.note_tweet?.text?.length) {
      tweetContentText += `\n${r.note_tweet.text}`;
    } else if (r.text?.length) {
      tweetContentText += `\n${r.text}`;
    }
  });

  return tweetContentText;
}

export async function getMediaUrls(
  parentTweet: TweetV2SingleResult,
  threadReplies: TweetV2[],
): Promise<string[]> {
  const mediaUrls: string[] = [];

  if (parentTweet.includes?.media?.length) {
    const parentMediaUrls = parentTweet.includes?.media
      .filter((m) => (m.url && m.type === "photo") || m.type.includes("gif"))
      .flatMap((m) => (m.url ? [m.url] : []));
    mediaUrls.push(...parentMediaUrls);
  }

  const threadMediaKeys = threadReplies
    .flatMap((r) => r.attachments?.media_keys)
    .filter((m): m is string => !!m);
  const threadMediaUrlPromises = threadMediaKeys.map(async (k) => {
    const imgUrl = `https://pbs.twimg.com/media/${k}?format=jpg`;
    try {
      const { contentType } = await imageUrlToBuffer(imgUrl);
      if (contentType.startsWith("image/")) {
        return imgUrl;
      }
    } catch (e) {
      console.error(
        `Failed to get content type for Twitter media URL: ${imgUrl}\n`,
        e,
      );
    }

    return undefined;
  });

  const threadMediaUrls = (await Promise.all(threadMediaUrlPromises)).filter(
    (m): m is string => !!m,
  );
  mediaUrls.push(...threadMediaUrls);

  return mediaUrls;
}
