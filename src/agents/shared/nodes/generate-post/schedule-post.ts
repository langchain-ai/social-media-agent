import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  BaseGeneratePostState,
  BaseGeneratePostUpdate,
  ComplexPost,
} from "./types.js";
import { Client } from "@langchain/langgraph-sdk";
import {
  getScheduledDateSeconds,
  getFutureDate,
} from "../../../../utils/schedule-date/index.js";
import { SlackClient } from "../../../../clients/slack/client.js";
import { isTextOnly, shouldPostToLinkedInOrg } from "../../../utils.js";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../../../generate-post/constants.js";

interface SendSlackMessageArgs {
  isTextOnlyMode: boolean;
  afterSeconds: number | undefined;
  threadId: string;
  runId: string;
  postContent: string | ComplexPost;
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

  const slackClient = new SlackClient();

  const postStr =
    typeof postContent === "string"
      ? `Post:
\`\`\`
${postContent}
\`\`\``
      : `Main post:
\`\`\`
${postContent.main_post}
\`\`\`
Reply post:
\`\`\`
${postContent.reply_post}
\`\`\``;

  const imageString = image?.imageUrl
    ? `Image:
${image?.imageUrl}`
    : "No image provided";

  const messageString = `*New Post Scheduled*
    
Scheduled post for: *${afterSeconds ? getFutureDate(afterSeconds) : "now"}*
Run ID: *${runId}*
Thread ID: *${threadId}*

${postStr}

${!isTextOnlyMode ? imageString : "Text only mode enabled. Image support has been disabled."}`;

  await slackClient.sendMessage(process.env.SLACK_CHANNEL_ID, messageString);
}

export async function schedulePost<
  State extends BaseGeneratePostState = BaseGeneratePostState,
  Update extends BaseGeneratePostUpdate = BaseGeneratePostUpdate,
>(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  if (!state.post) {
    throw new Error("No post to schedule found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  let afterSeconds: number | undefined;
  if (state.scheduleDate) {
    afterSeconds = await getScheduledDateSeconds({
      scheduleDate: state.scheduleDate,
      config,
    });
  }

  const thread = await client.threads.create();
  const run = await client.runs.create(thread.thread_id, "upload_post", {
    input: {
      post: state.post,
      complexPost: state.complexPost,
      image: state.image,
    },
    config: {
      configurable: {
        [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
        [TEXT_ONLY_MODE]: isTextOnlyMode,
      },
    },
    ...(afterSeconds ? { afterSeconds } : {}),
  });

  try {
    await sendSlackMessage({
      isTextOnlyMode,
      afterSeconds,
      threadId: thread.thread_id,
      runId: run.run_id,
      postContent: state.complexPost || state.post,
      image: state.image,
    });
  } catch (e) {
    console.error("Failed to send schedule post Slack message", e);
  }

  return {} as Update;
}
