import { ChatAnthropic } from "@langchain/anthropic";
import { RepurposerState } from "../types.js";
import { z } from "zod";
import { formatReportForPrompt } from "../utils.js";

const REWRITE_POSTS_PROMPT = `<context>
You're a highly regarded marketing employee, working on crafting thoughtful and engaging content for your LinkedIn and Twitter pages.
You wrote a series of posts for a marketing campaign for your LinkedIn and Twitter pages, however your boss has asked for some changes to one or more of the posts to be made before they can be published.
You're provided with the original campaign plan, and marketing report used to initially write the posts.
Use this plan to guide your decisions, however ensure you weigh your boss's requests above the plan if they contradict each other.
</context>

<original-posts>
{ORIGINAL_POSTS}
</original-posts>

<original-campaign-plan>
{ORIGINAL_CAMPAIGN_PLAN}
</original-campaign-plan>

<marketing-report>
{MARKETING_REPORT}
</marketing-report>

<instructions>
Listen to your boss closely, and make the necessary changes to the posts. If he does not explicitly state which post(s) needs to be updated, do your best to infer which post(s) he wants updated.
Do NOT make any changes other than those requested by your boss.
You should respond with ALL of the posts, including those you did not update. Respond with the unchanged posts exactly how they were presented to you.
Do not let your boss down, ensure your updates are clean, and fulfill his requests.
</instructions>`;

const updatePostsPrompt = z.object({
  posts: z
    .array(
      z
        .object({
          content: z
            .string()
            .describe("The updated, or unchanged post content."),
          index: z
            .number()
            .describe(
              "The index of the post as originally written in the context provided to you.",
            ),
        })
        .describe("The updated, or unchanged post and its index."),
    )
    .describe(
      "The full list of posts, including the updated, and unchanged posts.",
    ),
});

export async function rewritePosts(
  state: RepurposerState,
): Promise<Partial<RepurposerState>> {
  if (!state.userResponse) {
    throw new Error("Can not rewrite posts without user response");
  }

  const model = new ChatAnthropic({
    model: "claude-3-5-sonnet-latest",
    temperature: 0,
  }).bindTools(
    [
      {
        name: "update_posts",
        schema: updatePostsPrompt,
        description: "Update the posts based on the user's requests.",
      },
    ],
    {
      tool_choice: "update_posts",
    },
  );

  const formattedPrompt = REWRITE_POSTS_PROMPT.replace(
    "{ORIGINAL_POSTS}",
    state.posts
      .map((p) => `<post index="${p.index}">\n${p.content}\n</post>`)
      .join("\n"),
  )
    .replace("{ORIGINAL_CAMPAIGN_PLAN}", state.campaignPlan)
    .replace("{MARKETING_REPORT}", formatReportForPrompt(state.reports[0]));

  const response = await model.invoke([
    {
      role: "system",
      content: formattedPrompt,
    },
    {
      role: "user",
      content: state.userResponse,
    },
  ]);

  return {
    next: undefined,
    userResponse: undefined,
    posts: (response.tool_calls?.[0].args as z.infer<typeof updatePostsPrompt>)
      .posts,
  };
}
