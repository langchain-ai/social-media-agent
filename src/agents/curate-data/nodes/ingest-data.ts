import { CurateDataConfigurable, CurateDataState } from "../state.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { aiNewsBlogLoader } from "../loaders/ai-news-blog.js";
import {
  twitterLoader,
  twitterLoaderWithLangChain,
} from "../loaders/twitter.js";
import { tweetclawLoader } from "../loaders/tweetclaw.js";
import { getLangChainRedditPosts, getRedditPosts } from "../loaders/reddit.js";
import { githubTrendingLoader } from "../loaders/github/trending.js";
import { TweetV2 } from "twitter-api-v2";
import { latentSpaceLoader } from "../loaders/latent-space.js";
import { SimpleRedditPostWithComments } from "../../../clients/reddit/types.js";
import { langchainDependencyReposLoader } from "../loaders/github/langchain.js";
import { useLangChainPrompts } from "../../utils.js";
import {
  NUM_POSTS_PER_SUBREDDIT,
  TWEETCLAW_SEARCH_LIMIT,
  TWEETCLAW_SEARCH_QUERY,
} from "../constants.js";

export async function ingestData(
  _state: CurateDataState,
  config: LangGraphRunnableConfig,
): Promise<Partial<CurateDataState>> {
  const sources = (config.configurable as CurateDataConfigurable | undefined)
    ?.sources;
  if (!sources) {
    throw new Error("No sources provided");
  }
  if (!process.env.PORT) {
    throw new Error("PORT environment variable not set");
  }

  let tweets: TweetV2[] = [];
  let trendingRepos: string[] = [];
  let latentSpacePosts: string[] = [];
  let aiNewsPosts: string[] = [];
  let redditPosts: SimpleRedditPostWithComments[] = [];

  if (useLangChainPrompts()) {
    if (sources.includes("twitter")) {
      try {
        tweets = await twitterLoaderWithLangChain(config.store);
      } catch (e) {
        console.error("Failed to load tweets with LangChain prompts", e);
      }
    }
    if (sources.includes("tweetclaw")) {
      try {
        tweets = [
          ...tweets,
          ...(await tweetclawLoader({
            limit: config.configurable?.[TWEETCLAW_SEARCH_LIMIT],
            searchQuery: config.configurable?.[TWEETCLAW_SEARCH_QUERY],
          })),
        ];
      } catch (e) {
        console.error("Failed to load tweets with TweetClaw", e);
      }
    }
    if (sources.includes("github")) {
      try {
        trendingRepos = await langchainDependencyReposLoader(config.store);
      } catch (e) {
        console.error(
          "Failed to load trending repos with LangChain prompts",
          e,
        );
      }
    }
    if (sources.includes("reddit")) {
      try {
        redditPosts = await getLangChainRedditPosts(
          config.store,
          config.configurable?.[NUM_POSTS_PER_SUBREDDIT],
        );
      } catch (e) {
        console.error("Failed to load Reddit posts with LangChain prompts", e);
      }
    }

    // Latent space and AI news are not high signal for LangChain. Return early in this case.
    return {
      rawTweets: tweets,
      rawTrendingRepos: trendingRepos,
      rawRedditPosts: redditPosts,
    };
  }

  if (sources.includes("twitter")) {
    try {
      tweets = await twitterLoader();
    } catch (e) {
      console.error("Failed to load tweets", e);
    }
  }
  if (sources.includes("tweetclaw")) {
    try {
      tweets = [
        ...tweets,
        ...(await tweetclawLoader({
          limit: config.configurable?.[TWEETCLAW_SEARCH_LIMIT],
          searchQuery: config.configurable?.[TWEETCLAW_SEARCH_QUERY],
        })),
      ];
    } catch (e) {
      console.error("Failed to load tweets with TweetClaw", e);
    }
  }
  if (sources.includes("github")) {
    try {
      trendingRepos = await githubTrendingLoader(config.store);
    } catch (e) {
      console.error("Failed to load trending repos", e);
    }
  }
  if (sources.includes("reddit")) {
    try {
      redditPosts = await getRedditPosts(config.store);
    } catch (e) {
      console.error("Failed to load Reddit posts", e);
    }
  }
  if (sources.includes("latent_space")) {
    latentSpacePosts = await latentSpaceLoader(config.store);
  }
  if (sources.includes("ai_news")) {
    aiNewsPosts = await aiNewsBlogLoader();
  }

  return {
    rawTweets: tweets,
    rawTrendingRepos: trendingRepos,
    generalUrls: latentSpacePosts,
    aiNewsPosts,
    rawRedditPosts: redditPosts,
  };
}
