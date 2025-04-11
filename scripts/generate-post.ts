import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import {
  SKIP_CONTENT_RELEVANCY_CHECK,
  SKIP_USED_URLS_CHECK,
  TEXT_ONLY_MODE,
} from "../src/agents/generate-post/constants.js";

/**
 * Generate a post based on a LangChain blog post.
 * This may be modified to generate posts for other content.
 */
async function invokeGraph(url: string) {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  const { thread_id } = await client.threads.create();
  await client.runs.create(thread_id, "generate_post", {
    input: {
      links: [url],
    },
    config: {
      configurable: {
        // By default, the graph will read these values from the environment
        // [TWITTER_USER_ID]: process.env.TWITTER_USER_ID,
        // [LINKEDIN_USER_ID]: process.env.LINKEDIN_USER_ID,
        // This ensures the graph runs in a basic text only mode.
        // If you followed the full setup instructions, you may remove this line.
        [TEXT_ONLY_MODE]: true,
        // These will skip content relevancy checks and used URLs checks
        [SKIP_CONTENT_RELEVANCY_CHECK]: true,
        [SKIP_USED_URLS_CHECK]: true,
      },
    },
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const url = urlArg ? urlArg.split('=')[1] : "https://blog.langchain.dev/customers-appfolio/";

invokeGraph(url).catch(console.error);
