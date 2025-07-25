import { Client } from "@langchain/langgraph-sdk";
import { RepurposerState, RepurposerUpdate } from "../types.js";

export async function startInterruptGraphRuns(
  state: RepurposerState,
): Promise<RepurposerUpdate> {
  const client = new Client({
    apiUrl:
      process.env.LANGGRAPH_API_URL || `http://localhost:${process.env.PORT}`,
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
      });
    }),
  );

  await Promise.all(runsPromise);

  return {};
}
