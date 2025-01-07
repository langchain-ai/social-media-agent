import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { Client } from "@langchain/langgraph-sdk";
import {
  LLM_MODEL_NAME,
  POST_TO_LINKEDIN_ORGANIZATION,
} from "../../constants.js";
import { getScheduledDateSeconds } from "./find-date.js";
import { SlackClient } from "../../../../clients/slack.js";
import { getFutureDate } from "./get-future-date.js";

export async function schedulePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.post || !state.scheduleDate) {
    throw new Error("No post or schedule date found");
  }
  const twitterUserId = process.env.TWITTER_USER_ID;
  const linkedInUserId = process.env.LINKEDIN_USER_ID;

  if (!twitterUserId && !linkedInUserId) {
    throw new Error("One of twitterUserId or linkedInUserId must be provided");
  }

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const afterSeconds = await getScheduledDateSeconds(
    state.scheduleDate,
    config,
  );

  const thread = await client.threads.create();
  const run = await client.runs.create(thread.thread_id, "upload_post", {
    input: {
      post: state.post,
      image: state.image,
    },
    config: {
      configurable: {
        [POST_TO_LINKEDIN_ORGANIZATION]:
          config.configurable?.[POST_TO_LINKEDIN_ORGANIZATION] ||
          process.env.POST_TO_LINKEDIN_ORGANIZATION,
        [LLM_MODEL_NAME]:
          config.configurable?.[LLM_MODEL_NAME] || "gemini-2.0-flash-exp",
      },
    },
    afterSeconds,
  });

  try {
    const slackClient = new SlackClient({
      channelId: process.env.SLACK_CHANNEL_ID,
    });

    const imageString = state.image?.imageUrl
      ? `Image:
${state.image?.imageUrl}`
      : "No image provided";

    await slackClient.sendMessage(`**New Post Scheduled**
      
Scheduled post for: **${getFutureDate(afterSeconds)}**
Run ID: **${run.run_id}**
Thread ID: **${thread.thread_id}**

Post:
\`\`\`
${state.post}
\`\`\`

${imageString}`);
  } catch (e) {
    console.error("Failed to schedule post", e);
  }

  return {};
}
