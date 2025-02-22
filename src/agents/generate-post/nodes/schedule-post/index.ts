import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { Client } from "@langchain/langgraph-sdk";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../../constants.js";
import {
  getScheduledDateSeconds,
  getFutureDate,
} from "../../../../utils/schedule-date/index.js";
import { SlackClient } from "../../../../clients/slack.js";
import { isTextOnly, shouldPostToLinkedInOrg } from "../../../utils.js";

interface SendSlackMessageArgs {
  isTextOnlyMode: boolean;
  afterSeconds: number;
  threadId: string;
  runId: string;
  postContent: string;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function sendSlackMessage({
  isTextOnlyMode,
  afterSeconds,
  threadId,
  runId,
  postContent,
  image,
}: SendSlackMessageArgs) {
  if (!process.env.SLACK_CHANNEL_ID) {
    console.warn(
      "No SLACK_CHANNEL_ID found in environment variables. Can not send error message to Slack.",
    );
    return;
  }

  const slackClient = new SlackClient({
    channelId: process.env.SLACK_CHANNEL_ID,
  });

  const imageString = image?.imageUrl
    ? `Image:
${image?.imageUrl}`
    : "No image provided";

  const messageString = `*New Post Scheduled*
    
Scheduled post for: *${getFutureDate(afterSeconds)}*
Run ID: *${runId}*
Thread ID: *${threadId}*

Post:
\`\`\`
${postContent}
\`\`\`

${!isTextOnlyMode ? imageString : "Text only mode enabled. Image support has been disabled."}`;

  await slackClient.sendMessage(messageString);
}

export async function schedulePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.post || !state.scheduleDate) {
    throw new Error("No post or schedule date found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const afterSeconds = await getScheduledDateSeconds({
    scheduleDate: state.scheduleDate,
    config,
  });

  const thread = await client.threads.create();
  const run = await client.runs.create(thread.thread_id, "upload_post", {
    input: {
      post: state.post,
      image: state.image,
    },
    config: {
      configurable: {
        [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
        [TEXT_ONLY_MODE]: isTextOnlyMode,
      },
    },
    afterSeconds,
  });

  try {
    await sendSlackMessage({
      isTextOnlyMode,
      afterSeconds,
      threadId: thread.thread_id,
      runId: run.run_id,
      postContent: state.post,
      image: state.image,
    });
  } catch (e) {
    console.error("Failed to send schedule post Slack message", e);
  }

  return {};
}
