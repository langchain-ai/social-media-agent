import { VerifyTweetAnnotation } from "../verify-tweet-state.js";
import { extractTweetId } from "../../utils.js";
import {
  getFullThreadText,
  getMediaUrls,
  resolveAndReplaceTweetTextLinks,
} from "../../../clients/twitter/utils.js";
import { TweetV2, TweetV2SingleResult } from "twitter-api-v2";
import { shouldExcludeTweetContent } from "../../should-exclude.js";
import { getTwitterClient } from "../../../clients/twitter/client.js";

export async function getTweetContent(
  state: typeof VerifyTweetAnnotation.State,
) {
  const tweetId = extractTweetId(state.link);
  if (!tweetId) {
    console.error("Failed to extract tweet ID from link:", state.link);
    return {};
  }

  const twitterClient = await getTwitterClient();

  let tweetContent: TweetV2SingleResult | undefined;

  try {
    tweetContent = await twitterClient.getTweet(tweetId);
    if (!tweetContent) {
      throw new Error("No tweet content returned from Twitter API.");
    }
  } catch (e: any) {
    console.error("Failed to get tweet content", e);
    return {};
  }

  const threadReplies: TweetV2[] = [];
  if (tweetContent.data.author_id) {
    threadReplies.push(
      ...(await twitterClient.getThreadReplies(
        tweetId,
        tweetContent.data.author_id,
      )),
    );
  }

  const mediaUrls = await getMediaUrls(tweetContent, threadReplies);
  const tweetContentText = getFullThreadText(tweetContent, threadReplies);

  const { content, externalUrls } =
    await resolveAndReplaceTweetTextLinks(tweetContentText);

  const shouldExclude = shouldExcludeTweetContent(externalUrls);
  if (shouldExclude) {
    return {};
  }

  if (!externalUrls.length) {
    return {
      tweetContent: content,
      imageOptions: mediaUrls,
    };
  }

  return {
    tweetContent: content,
    tweetContentUrls: externalUrls,
    imageOptions: mediaUrls,
  };
}
