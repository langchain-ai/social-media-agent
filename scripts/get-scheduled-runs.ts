import "dotenv/config";
import { Client, Run } from "@langchain/langgraph-sdk";
import { SlackClient } from "../src/clients/slack.js";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

type PendingRun = {
  thread_id: string;
  run_id: string;
  post: string;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
  scheduleDate: string;
};

async function sendPendingRunsToSlack(messageString: string) {
  const slackClient = new SlackClient({
    channelId: process.env.SLACK_CHANNEL_ID,
  });

  await slackClient.sendMessage(messageString);
}

async function getScheduledRuns() {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
    // apiUrl: "http://localhost:54367",
  });
  const threads = await client.threads.search({
    metadata: {
      graph_id: "upload_post",
    },
    status: "busy",
  });
  let pendingRuns: PendingRun[] = [];
  for await (const thread of threads) {
    const runs = await client.runs.list(thread.thread_id);
    const run = runs[0] as Run & {
      kwargs: Record<string, any>;
    };
    if (!run) {
      console.warn(`No run found for thread ${thread.thread_id}`);
      continue;
    }
    pendingRuns.push({
      thread_id: thread.thread_id,
      run_id: run.run_id,
      post: run.kwargs.input.post,
      image: run.kwargs.input.image,
      scheduleDate: run.created_at,
    });
  }

  // Sort the pending runs by schedule date
  pendingRuns.sort((a, b) => {
    return (
      new Date(a.scheduleDate).getTime() - new Date(b.scheduleDate).getTime()
    );
  });

  const pendingRunsString = pendingRuns.map(
    (post, index) => `*Post ${index + 1}*:

Scheduled for *${format(toZonedTime(new Date(post.scheduleDate), "America/Los_Angeles"), "MM/dd hh:mm a")} PST*

Post:
\`\`\`
${post.post}
\`\`\`

Image:
\`\`\`
${post.image?.imageUrl}
\`\`\``,
  );

  const slackMessageContent = `Number of scheduled posts: *${pendingRuns.length}*
  
Scheduled posts:

${pendingRunsString.join("\n\n")}`;

  if (process.env.SLACK_CHANNEL_ID && process.env.SLACK_CHANNEL_ID) {
    await sendPendingRunsToSlack(slackMessageContent);
  } else {
    console.log(slackMessageContent);
  }
}

getScheduledRuns().catch(console.error);
