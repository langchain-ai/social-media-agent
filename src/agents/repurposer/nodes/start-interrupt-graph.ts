import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Client } from "@langchain/langgraph-sdk";
import { POST_TO_LINKEDIN_ORGANIZATION } from "../../generate-post/constants.js";
import { shouldPostToLinkedInOrg } from "../../utils.js";
import { RepurposerState, RepurposerUpdate } from "../types.js";

export async function startInterruptGraphRuns(
  state: RepurposerState,
  config?: LangGraphRunnableConfig,
): Promise<RepurposerUpdate> {
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
    apiKey: process.env.LANGCHAIN_API_KEY,
  });

  const runsPromise = await Promise.all(
    state.posts.map(async (post, index) => {
      const image = state.images.find((i) => i.index === index);
      const { thread_id } = await client.threads.create();
      await client.runs.create(thread_id, "repurposer_post_interrupt", {
        input: {
          post: post.content,
          image,
          originalLink: state.originalLink,
          originalContent: state.originalContent,
          contextLinks: state.contextLinks,
          additionalContexts: state.additionalContexts,
          reports: state.reports,
          imageOptions: state.imageOptions,
          posts: state.posts,
          campaignPlan: state.campaignPlan,
        },
        config: {
          configurable: {
            [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
          },
        },
      });
    }),
  );

  await Promise.all(runsPromise);

  return {};
}
