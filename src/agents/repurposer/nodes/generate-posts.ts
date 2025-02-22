import { ChatAnthropic } from "@langchain/anthropic";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { RepurposerState } from "../types.js";
import { z } from "zod";
import { formatReportForPrompt } from "../utils.js";

export const POST_STRUCTURE_INSTRUCTIONS = `The post should have three main sections, outlined below:
<structure-instructions>

<section key="1">
The first part of the post is the header. This should be very short, no more than 5 words, and should include one to two emojis, and the name of the content provided. If the marketing report does not specify a name, you should get creative and come up with a catchy title for it.
</section>

<section key="2">
This section will contain the main content of the post. The post body should contain a concise, high-level overview of the key point from the marketing report which was selected to be the focus of this post.
It should focus on what the content does, or the problem it solves. Also include details on how the content implements LangChain's product(s) and why these products are important to the application.
Ensure this is short, no more than 3 sentences. Optionally, if the content is very technical, you may include bullet points covering the main technical aspects of the content.
</section>

<section key="3">
The final section of the post should contain a call to action. This should be a short sentence that encourages the reader to click the link to the content being promoted. Optionally, you can include an emoji here.
</section>

</structure-instructions>`;

export const GENERATE_POST_PROMPT = `You're a highly regarded marketing employee, working on crafting thoughtful and engaging content for LinkedIn and Twitter pages.
You've been provided with a detailed marketing campaign report on content which you have already publicized, but want to renew interest in, and repurpose.

The following are examples of LinkedIn/Twitter posts that have done well, and you should use them as style inspiration for your post:
<examples>
${getPrompts().tweetExamples}
</examples>

Now that you've seen some examples, lets's cover the structure of each LinkedIn/Twitter post you will write:
${POST_STRUCTURE_INSTRUCTIONS}

This structure should ALWAYS be followed. And remember, the shorter and more engaging the post, the better (your yearly bonus depends on this!!).

Here are a set of rules and guidelines you should strictly follow when creating each LinkedIn/Twitter post:
<rules>
${getPrompts().postContentRules}
</rules>

Ensure you read over each plan item (or the only one one, depending on how many posts it requests you write) carefully, and ensure your post(s) flow well together.

Lastly, you should follow the process below when writing the LinkedIn/Twitter {POST_OR_POSTS}:
<writing-process>
Step 1. First, read over the marketing report VERY thoroughly. (the user will provide this)
Step 2. Once finished reading the marketing report, inspect the post campaign plan (the user will also provide this) so you have a deep understanding of each post you will need to write.
Step 3. Lastly, write {NUM_POSTS} LinkedIn/Twitter {POST_OR_POSTS}. Use all of the information provided above to help you write the post. Ensure you write only ONE post for both LinkedIn and Twitter.
</writing-process>

Given these examples, rules, and the content provided by the user, curate a LinkedIn/Twitter post that is engaging and follows the structure of the examples provided.
Ensure you do NOT make information up, or make assumptions about the content. Base your {POST_OR_POSTS} on the content and facts provided above.`;

const USER_PROMPT = `Hello. Please write {NUM_POSTS} new {POST_OR_POSTS} for my LinkedIn and Twitter pages.

Here is the marketing report you should use as the master context for all of the LinkedIn/Twitter posts you will write:
<report>
{MARKETING_REPORT}
</report>

Here is the plan for the new marketing campaign. You should generate {NUM_POSTS} new {POST_OR_POSTS} based on this plan:
<plan>
{CAMPAIGN_PLAN}
</plan>

Take in all of the provided context, and write {NUM_POSTS} new {POST_OR_POSTS} I, and you, would be happy with!`;

function formatUserPrompt(report: string, plan: string, numPosts: number) {
  const postOrPosts = numPosts === 1 ? "post" : "posts";
  return USER_PROMPT.replaceAll("{NUM_POSTS}", numPosts.toString())
    .replaceAll("{POST_OR_POSTS}", postOrPosts)
    .replace("{MARKETING_REPORT}", report)
    .replace("{CAMPAIGN_PLAN}", plan);
}

export async function generatePosts(
  state: RepurposerState,
): Promise<Partial<RepurposerState>> {
  const { quality: numPosts } = state;
  const postOrPosts = numPosts === 1 ? "post" : "posts";

  const postsSchema = z.object({
    posts: z
      .array(
        z
          .string()
          .describe(
            "The individual post for the LinkedIn/Twitter page. Ensure this post follows all of the instructions outlined in the prompt, and uses the context provided via the marketing report and post campaign plan.",
          ),
      )
      .describe(
        `The LinkedIn/Twitter  ${postOrPosts} you should write.${numPosts > 1 ? " Ensure each post is in the proper order they should be published in." : ""}`,
      ),
  });

  const model = new ChatAnthropic({
    model: "claude-3-5-sonnet-latest",
    temperature: 0.5,
  }).bindTools([
    {
      name: `write_${postOrPosts}`,
      description: `Write ${numPosts} LinkedIn/Twitter ${postOrPosts} based on the marketing report and post campaign plan provided.`,
      schema: postsSchema,
    },
  ]);

  const formattedSystemPrompt = GENERATE_POST_PROMPT.replaceAll(
    "{NUM_POSTS}",
    numPosts.toString(),
  ).replaceAll("{POST_OR_POSTS}", postOrPosts);

  const userPrompt = formatUserPrompt(
    formatReportForPrompt(state.reports[0]),
    state.campaignPlan,
    numPosts,
  );

  const result = await model.invoke([
    {
      role: "system",
      content: formattedSystemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ]);

  return {
    posts: (result.tool_calls?.[0].args?.posts as string[]).map(
      (content, index) => ({
        content,
        index,
      }),
    ),
  };
}
