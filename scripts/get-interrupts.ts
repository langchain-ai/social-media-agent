import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";

async function getInterrupts() {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
  });

  const newLinksArr: string[] = [
    // Add your new links here
  ];

  const { thread_id } = await client.threads.create();
  await client.runs.create(thread_id, "ingest_data", {
    input: {
      links: newLinksArr,
    },
    config: {
      configurable: {
        skipIngest: true,
      },
    },
  });
}

getInterrupts();
