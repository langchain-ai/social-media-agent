import {
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import {
  IngestDataConfigurableAnnotation,
  IngestDataAnnotation,
} from "./ingest-data-state.js";
import { ingestSlackData } from "./nodes/ingest-slack.js";
import { Client } from "@langchain/langgraph-sdk";
import {
  LLM_MODEL_NAME,
  POST_TO_LINKEDIN_ORGANIZATION,
} from "../generate-post/constants.js";
import { getUrlType } from "../utils.js";

/**
 * Calculates delay times for processing a list of URLs to prevent rate limiting.
 * Each URL gets a minimum 30-second delay from the previous URL's processing time.
 * Twitter URLs receive an additional 30-second delay due to stricter rate limits.
 *
 * @param links - Array of URLs to process
 * @returns Array of objects containing the original URL and its calculated delay time
 * @example
 * // For URLs: ['https://example.com', 'https://twitter.com/user', 'https://github.com']
 * // Returns:
 * // [
 * //   { link: 'https://example.com', afterSeconds: 0 },
 * //   { link: 'https://twitter.com/user', afterSeconds: 60 }, // 30 (base) + 30 (twitter)
 * //   { link: 'https://github.com', afterSeconds: 60 } // 30 * 2 (third position)
 * // ]
 */
function getAfterSecondsFromLinks(links: string[]): {
  link: string;
  afterSeconds: number;
}[] {
  const baseDelaySeconds = 30;
  return links.map((link, index) => {
    const isTwitterUrl = getUrlType(link) === "twitter";
    const additionalDelay = isTwitterUrl ? baseDelaySeconds : 0;
    const afterSeconds = index * baseDelaySeconds + additionalDelay;
    return {
      link,
      afterSeconds,
    };
  });
}

async function generatePostFromMessages(
  state: typeof IngestDataAnnotation.State,
  config: LangGraphRunnableConfig,
) {
  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const linkAndDelay = getAfterSecondsFromLinks(state.links);

  for await (const { link, afterSeconds } of linkAndDelay) {
    const thread = await client.threads.create();
    const postToLinkedInOrg =
      config.configurable?.[POST_TO_LINKEDIN_ORGANIZATION] != null
        ? config.configurable?.[POST_TO_LINKEDIN_ORGANIZATION]
        : process.env.POST_TO_LINKEDIN_ORGANIZATION;

    await client.runs.create(thread.thread_id, "generate_post", {
      input: {
        links: [link],
      },
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
          [LLM_MODEL_NAME]:
            config.configurable?.[LLM_MODEL_NAME] || "gemini-2.0-flash-exp",
        },
      },
      afterSeconds,
    });
  }
  return {};
}

const builder = new StateGraph(
  IngestDataAnnotation,
  IngestDataConfigurableAnnotation,
)
  // Ingests posts from Slack channel.
  .addNode("ingestSlackData", ingestSlackData)
  // Subgraph which is invoked once for each message.
  // This subgraph will verify content is relevant to
  // LangChain, generate a report on the content, and
  // finally generate and schedule a post.
  .addNode("generatePostGraph", generatePostFromMessages)
  // Start node
  .addEdge(START, "ingestSlackData")
  // After ingesting data, route to the subgraph for each message.
  .addEdge("ingestSlackData", "generatePostGraph")
  // Finish after generating the Twitter post.
  .addEdge("generatePostGraph", END);

export const graph = builder.compile();

graph.name = "Social Media Agent";
