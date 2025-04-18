import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import {
  SKIP_CONTENT_RELEVANCY_CHECK,
  SKIP_USED_URLS_CHECK,
  TEXT_ONLY_MODE,
} from "../src/agents/generate-post/constants.js";

/**
 * Generate posts based on multiple URLs.
 * Supports two modes:
 * - multi-post: Treats each URL as a single input, calls generate post multiple times
 * - single-post: Calls generate post once with all URLs as input
 */
async function invokeGraph(urls: string[], mode: 'multi-post' | 'single-post') {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  if (mode === 'multi-post') {
    // Process each URL individually
    for (const url of urls) {
      console.log(`Processing URL: ${url}`);
      const { thread_id } = await client.threads.create();
      await client.runs.create(thread_id, "generate_post", {
        input: {
          links: [url],
        },
        config: {
          configurable: {
            [TEXT_ONLY_MODE]: true,
            [SKIP_CONTENT_RELEVANCY_CHECK]: true,
            [SKIP_USED_URLS_CHECK]: true,
          },
        },
      });
      console.log(`Completed processing: ${url}`);
    }
  } else if (mode === 'single-post') {
    // Process all URLs in a single call
    console.log(`Processing ${urls.length} URLs in a single call`);
    const { thread_id } = await client.threads.create();
    await client.runs.create(thread_id, "generate_post", {
      input: {
        links: urls,
      },
      config: {
        configurable: {
          [TEXT_ONLY_MODE]: true,
          [SKIP_CONTENT_RELEVANCY_CHECK]: true,
          [SKIP_USED_URLS_CHECK]: true,
        },
      },
    });
    console.log(`Completed processing all URLs`);
  } else {
    throw new Error('Invalid mode');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const modeArg = args.find(arg => arg.startsWith('--mode='));
const urlsArg = args.find(arg => arg.startsWith('--urls='));

if (!modeArg || !urlsArg) {
  console.error('Usage: yarn generate-multiple-posts --mode=<multi-post|single-post> --urls=<url1,url2,...>');
  process.exit(1);
}

const mode = modeArg.split('=')[1] as 'multi-post' | 'single-post';
if (mode !== 'multi-post' && mode !== 'single-post') {
  console.error('Mode must be either "multi-post" or "single-post"');
  process.exit(1);
}

const urls = urlsArg.split('=')[1].split(',').map(url => url.trim());
if (urls.length === 0) {
  console.error('At least one URL must be provided');
  process.exit(1);
}

invokeGraph(urls, mode).catch(console.error);
