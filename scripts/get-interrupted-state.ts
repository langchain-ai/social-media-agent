import "dotenv/config";
import { Client, Thread } from "@langchain/langgraph-sdk";

async function getInterrupts() {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
  })

  const threads = await client.threads.search({
    status: "interrupted",
    limit: 1,
  })

  console.log(threads.length);

  await createNewInterrupts([threads[0]])
  console.log("CREATED NEW INTERRUPT")
  const threadIdToDelete = threads[0].thread_id;

  console.log("UPDATED", threadIdToDelete)
}

async function createNewInterrupts(threads: Thread<Record<string, any>>[]) {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
  })

  for (const thread of threads) {
    await client.runs.create(thread.thread_id, "generate_post", {
      command: {
        goto: "humanNode",
      }
    })
  }
}

getInterrupts().catch(console.error);