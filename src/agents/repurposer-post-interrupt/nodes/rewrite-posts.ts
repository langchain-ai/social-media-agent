import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { formatReportForPrompt } from "../../repurposer/utils.js";
import {
  RepurposerPostInterruptState,
  RepurposerPostInterruptUpdate,
} from "../types.js";

const REWRITE_POST_PROMPT = `<context>
You're a highly regarded marketing employee, working on crafting thoughtful and engaging content for your LinkedIn and Twitter pages.
You wrote a series of posts for a marketing campaign for your LinkedIn and Twitter pages, however your boss has asked for some changes to one of the posts to be made before they can be published.
You're provided with the original campaign plan, and marketing report used to initially write the collection of posts.
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

<post-to-update>
{POST_TO_UPDATE}
</post-to-update>

<instructions>
Listen to your boss closely, and make the necessary changes to the post.
You should ONLY update the post inside the <post-to-update> tag.
Ensure you keep the other posts in this campaign in mind when making updates, as we do not want to duplicate information, unless your boss explicitly requests it.
Do NOT make any changes other than those requested by your boss.
Do not let your boss down, ensure your updates are clean, and fulfill his requests.
</instructions>`;

const updatePostsPrompt = z.object({
  post: z.string().describe("The updated post content."),
});

export async function rewritePost(
  state: RepurposerPostInterruptState,
): Promise<RepurposerPostInterruptUpdate> {
  if (!state.userResponse) {
    throw new Error("Can not rewrite posts without user response");
  }

  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  }).bindTools(
    [
      {
        name: "update_post",
        schema: updatePostsPrompt,
        description: "Update the post based on the user's requests.",
      },
    ],
    {
      tool_choice: "update_post",
    },
  );

  const formattedPrompt = REWRITE_POST_PROMPT.replace(
    "{POST_TO_UPDATE}",
    state.post,
  )
    .replace(
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

  const toolCall = response.tool_calls?.[0].args as z.infer<
    typeof updatePostsPrompt
  >;

  return {
    next: undefined,
    userResponse: undefined,
    post: toolCall.post,
  };
}
