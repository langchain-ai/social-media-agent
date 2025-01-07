import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";

/**
 * Generate a post based on the Open Canvas project.
 * Meant to be used as a demo, showing off how the
 * Social Media Agent works.
 */
async function invokeGraph() {
  const link = "https://github.com/langchain-ai/open-canvas";

  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  const { thread_id } = await client.threads.create();
  await client.runs.create(thread_id, "generate_post", {
    input: {
      links: [link],
    },
  });
}

invokeGraph().catch(console.error);
