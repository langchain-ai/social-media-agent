import { Annotation } from "@langchain/langgraph";
import {
  CuratedData,
  GitHubTrendingData,
  ThreadRunId,
  TweetsGroupedByContent,
} from "./types.js";
import { TweetV2 } from "twitter-api-v2";
import { SimpleRedditPostWithComments } from "../../clients/reddit/types.js";
import { RedditPostsWithExternalData } from "../verify-reddit-post/types.js";
import { NUM_POSTS_PER_SUBREDDIT } from "./constants.js";
import { Source } from "../supervisor/types.js";
import { VerifyLinksResultAnnotation } from "../verify-links/verify-links-state.js";
import { SKIP_CONTENT_RELEVANCY_CHECK } from "../generate-post/constants.js";

export const CurateDataAnnotation = Annotation.Root({
  ...VerifyLinksResultAnnotation.spec,
  /**
   * The final data object to be returned.
   */
  curatedData: Annotation<CuratedData>,
  /**
   * Collection of saved tweets from a Twitter list.
   * Each tweet contains metadata like ID, creation time, text content, and media references.
   */
  rawTweets: Annotation<TweetV2[]>,
  /**
   * A list of validated tweets.
   */
  validatedTweets: Annotation<TweetV2[]>,
  /**
   * Tweets which have been grouped by their external URLs.
   * Each group contains a list of tweets which reference the same external URL.
   */
  tweetsGroupedByContent: Annotation<TweetsGroupedByContent[]>,
  /**
   * Array of indices of similar groups of tweets to re-evaluate the grouping of.
   */
  similarGroupIndices: Annotation<number[]>,

  /**
   * List of trending GitHub repository names/paths.
   */
  rawTrendingRepos: Annotation<string[]>,
  /**
   * A list of trending GitHub repositories & README contents which have been
   * validated.
   */
  githubTrendingData: Annotation<GitHubTrendingData[]>,

  /**
   * A list of new AI Newsletter posts.
   */
  aiNewsPosts: Annotation<string[]>,
  /**
   * Collection of saved Reddit posts and their associated comments.
   * Each post contains the original content and relevant discussion threads.
   */
  rawRedditPosts: Annotation<SimpleRedditPostWithComments[]>,
  /**
   * A list of verified Reddit posts.
   */
  redditPosts: Annotation<RedditPostsWithExternalData[]>,
  /**
   * The thread & run IDs for runs kicked off after curating data.
   */
  threadRunIds: Annotation<ThreadRunId[]>,
  /**
   * General URLs to scrape content from.
   */
  generalUrls: Annotation<string[]>,
});

export const CurateDataConfigurableAnnotation = Annotation.Root({
  /**
   * The sources to ingest from.
   */
  sources: Annotation<Source[]>,
  /**
   * The number of posts to fetch per subreddit when ingesting Reddit posts.
   */
  [NUM_POSTS_PER_SUBREDDIT]: Annotation<number | undefined>(),
  [SKIP_CONTENT_RELEVANCY_CHECK]: Annotation<boolean | undefined>(),
});

export type CurateDataState = typeof CurateDataAnnotation.State;
export type CurateDataConfigurable =
  typeof CurateDataConfigurableAnnotation.State;
