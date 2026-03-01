import { TweetV2 } from "twitter-api-v2";
import { SimpleRedditPostWithComments } from "../../clients/reddit/types.js";

export type TweetV2WithURLs = TweetV2 & {
  external_urls: string[];
};

export type GitHubTrendingData = {
  repoURL: string;
  pageContent: string;
  stargazersCount?: number;
};

export type TweetsGroupedByContent = {
  explanation: string;
  tweets: TweetV2WithURLs[];
};

export type ThreadRunId = { thread_id: string; run_id: string };

export type CuratedData = {
  /**
   * The tweets grouped by content.
   */
  tweetsGroupedByContent?: TweetsGroupedByContent[];
  /**
   * If reports were curated, they will be included here.
   */
  redditPosts?: SimpleRedditPostWithComments[];
  /**
   * The general content scraped from URLs
   */
  generalContents?: {
    pageContent: string;
    relevantLinks: string[];
  }[];
  /**
   * The GitHub trending data.
   */
  githubTrendingData?: GitHubTrendingData[];
};
