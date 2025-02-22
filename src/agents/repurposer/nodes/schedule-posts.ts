import { Client } from "@langchain/langgraph-sdk";
import { RepurposerState } from "../types.js";
import {
  getFutureDate,
  getScheduledDateSeconds,
} from "../../../utils/schedule-date/index.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { capitalize, shouldPostToLinkedInOrg } from "../../utils.js";
import { POST_TO_LINKEDIN_ORGANIZATION } from "../../generate-post/constants.js";
import { SlackClient } from "../../../clients/slack.js";
import { DateType } from "../../types.js";

interface SendSlackMessageArgs {
  posts: {
    afterSeconds: number;
    threadId: string;
    runId: string;
    postContent: string;
    image?: string;
  }[];
  priority: DateType;
}

async function sendSlackMessage({ posts, priority }: SendSlackMessageArgs) {
  if (!process.env.SLACK_CHANNEL_ID) {
    console.warn(
      "No SLACK_CHANNEL_ID found in environment variables. Can not send error message to Slack.",
    );
    return;
  }

  const slackClient = new SlackClient({
    channelId: process.env.SLACK_CHANNEL_ID,
  });

  const postOrPosts = posts.length > 1 ? "posts" : "post";

  let description = `*New Repurposed ${capitalize(postOrPosts)} Scheduled*
Total posts: *${posts.length}*
Schedule Priority: *${priority}*`;

  for (const { afterSeconds, threadId, runId, postContent, image } of posts) {
    const imageString = image
      ? `Image:
${image}`
      : "No image provided";

    const messageString = `Scheduled post for: *${getFutureDate(afterSeconds)}*
Run ID: *${runId}*
Thread ID: *${threadId}*

Post:
\`\`\`
${postContent}
\`\`\`

${imageString}`;

    description += `\n\n------------------\n${messageString}`;
  }

  await slackClient.sendMessage(description);
}

export async function schedulePosts(
  state: RepurposerState,
  config: LangGraphRunnableConfig,
): Promise<Partial<RepurposerState>> {
  if (!state.scheduleDate) {
    throw new Error("No schedule date found");
  }

  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const allAfterSeconds = await getScheduledDateSeconds({
    scheduleDate: state.scheduleDate,
    numberOfDates: state.posts.length,
    config,
  });

  const startRunsPromises = state.posts.map(async (post) => {
    const afterSeconds = allAfterSeconds[post.index];
    if (!afterSeconds) {
      throw new Error("No after seconds found for post index " + post.index);
    }
    const { thread_id } = await client.threads.create();
    const { run_id } = await client.runs.create(thread_id, "upload_post", {
      input: {
        post: post.content,
        image: state.images?.find((image) => image.index === post.index),
      },
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
        },
      },
      afterSeconds,
    });

    return {
      threadId: thread_id,
      runId: run_id,
      afterSeconds,
      postContent: post.content,
      image: state.images.find((image) => image.index === post.index)?.imageUrl,
    };
  });

  const startedRuns = await Promise.all(startRunsPromises);

  try {
    await sendSlackMessage({
      posts: startedRuns,
      priority: state.scheduleDate,
    });
  } catch (e) {
    console.error("Failed to send schedule repurposed post Slack message", e);
  }

  return {};
}
