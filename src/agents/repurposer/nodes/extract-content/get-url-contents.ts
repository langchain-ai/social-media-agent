import { TweetV2, TweetV2SingleResult } from "twitter-api-v2";
import { getTwitterClient } from "../../../../clients/twitter/client.js";
import {
  extractTweetId,
  extractAllImageUrlsFromMarkdown,
  getUrlType,
} from "../../../utils.js";
import { FireCrawlLoader } from "@langchain/community/document_loaders/web/firecrawl";
import {
  getFullThreadText,
  getMediaUrls,
  resolveAndReplaceTweetTextLinks,
} from "../../../../clients/twitter/utils.js";
import { getVideoSummary } from "../../../shared/youtube/video-summary.js";
import { getImagesFromFireCrawlMetadata } from "../../../../utils/firecrawl.js";

async function getGeneralContent(url: string): Promise<{
  contents: string;
  imageUrls: string[];
}> {
  try {
    const loader = new FireCrawlLoader({
      url,
      mode: "scrape",
      params: {
        formats: ["markdown"],
      },
    });

    const docs = await loader.load();

    const metadataImageUrls = docs.flatMap(
      (d) => getImagesFromFireCrawlMetadata(d.metadata) || [],
    );
    const imageUrlsFromText = extractAllImageUrlsFromMarkdown(
      docs[0].pageContent,
    );

    return {
      contents: `<webpage-content url="${url}">\n${docs[0].pageContent}\n</webpage-content>`,
      imageUrls: Array.from(
        new Set([...metadataImageUrls, ...imageUrlsFromText]),
      ),
    };
  } catch (e) {
    throw new Error(`Failed to fetch content from ${url}.` + e);
  }
}

async function getYouTubeContent(url: string): Promise<{
  contents: string;
  imageUrls: string[];
}> {
  try {
    const { summary, thumbnail } = await getVideoSummary(url);
    return {
      contents: `<youtube-video-summary>\n${summary}</youtube-video-summary>`,
      imageUrls: thumbnail ? [thumbnail] : [],
    };
  } catch (e) {
    throw new Error(`Failed to get YouTube summary for URL ${url}` + e);
  }
}

async function getTwitterContent(url: string): Promise<{
  contents: string;
  imageUrls: string[];
}> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    throw new Error("Failed to extract tweet ID from link:" + url);
  }

  const twitterClient = await getTwitterClient();
  let tweetContent: TweetV2SingleResult | undefined;

  try {
    tweetContent = await twitterClient.getTweet(tweetId);
    if (!tweetContent) {
      throw new Error("No tweet content returned from Twitter API.");
    }
  } catch (e: any) {
    throw new Error(`Failed to get tweet content from ${url}.` + e);
  }

  const threadReplies: TweetV2[] = [];
  if (tweetContent.includes?.users?.length) {
    const username = tweetContent.includes?.users[0]?.username;
    threadReplies.push(
      ...(await twitterClient.getThreadReplies(tweetId, username)),
    );
  }

  const mediaUrls = await getMediaUrls(tweetContent, threadReplies);
  const tweetContentText = getFullThreadText(tweetContent, threadReplies);

  const { content, externalUrls } =
    await resolveAndReplaceTweetTextLinks(tweetContentText);

  const externalUrlPromises = externalUrls.map(async (url) => {
    const type = getUrlType(url);

    try {
      if (type === "general") {
        return getGeneralContent(url);
      } else if (type === "youtube") {
        return getYouTubeContent(url);
      }
    } catch (e) {
      console.error(`Failed to get content from ${url} extracted in Tweet.`, e);
    }

    return {
      contents: "",
      imageUrls: [],
    };
  });
  const externalUrlsContent = await Promise.all(externalUrlPromises);

  return {
    contents: `<twitter-thread>
  <post>
    ${content}
  </post>
  <external-urls-content>
    ${externalUrlsContent.map((c, idx) => `<external-content index="${idx}">\n${c.contents}\n</external-content>`).join("\n")}
  </external-urls-content>
</twitter-thread>`,
    imageUrls: mediaUrls,
  };
}

/**
 * Extracts the contents from a given URL. This can be either a blog post, tweet, or YouTube video.
 */
export async function getUrlContents(url: string): Promise<{
  contents: string;
  imageUrls: string[];
}> {
  const type = getUrlType(url);

  if (type === "general") {
    return getGeneralContent(url);
  } else if (type === "youtube") {
    return getYouTubeContent(url);
  } else if (type === "twitter") {
    return getTwitterContent(url);
  }

  throw new Error(`Unsupported URL type: ${type}`);
}
