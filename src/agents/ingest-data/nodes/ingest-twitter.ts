import { IngestDataAnnotation } from "../ingest-data-state.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import Arcade from "@arcadeai/arcadejs";
import { getArcadeTwitterAuthOrInterrupt } from "../../shared/auth/twitter.js";
import { INGEST_TWITTER_USERNAME } from "../../generate-post/constants.js";

type TweetResult = {
  author_id: string;
  author_name: string;
  author_username: string;
  edit_history_tweet_ids: string[];
  id: string;
  text: string;
  tweet_url: string;
};

/**
 * Ingests Twitter data into the graph.
 *
 * This function will ingest tweets by a username.
 *
 * @param state The current state of the graph.
 * @param config The configuration for the ingest operation.
 * @returns A partial update to the graph state with the ingested tweets.
 */
export async function ingestTweets(
  state: typeof IngestDataAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof IngestDataAnnotation.State>> {
  if (config.configurable?.skipIngest) {
    if (state.links.length === 0) {
      throw new Error("Can not skip ingest with no links");
    }
    return {};
  }
  const twitterUserId = process.env.TWITTER_USER_ID;
  if (!twitterUserId) {
    throw new Error("Twitter user ID not found in configurable fields.");
  }

  const username = config.configurable?.[INGEST_TWITTER_USERNAME] as
    string | undefined;
  if (!username) {
    throw new Error("Twitter username not found in configurable fields.");
  }

  const arcade = new Arcade({
    apiKey: process.env.ARCADE_API_KEY,
  });
  await getArcadeTwitterAuthOrInterrupt(twitterUserId, arcade);

  let links: string[] = [];
  const result = await arcade.tools.execute({
    tool_name: "X.SearchRecentTweetsByUsername",
    input: {
      username,
      // (integer, optional, Defaults to 10) The maximum number of results to return. Cannot be less than 10.
      // 15 since the rate limit is 15 req/15 min
      max_results: 15,
    },
    user_id: twitterUserId,
  });

  const castValue = result.output?.value as { data: TweetResult[] | undefined };
  if (castValue && castValue.data) {
    links = castValue.data.map((t) => t.tweet_url);
  }

  return {
    links,
  };
}
