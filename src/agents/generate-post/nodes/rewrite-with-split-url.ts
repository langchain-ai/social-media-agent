import { z } from "zod";
import {
  GeneratePostState,
  GeneratePostUpdate,
} from "../generate-post-state.js";
import { ChatAnthropic } from "@langchain/anthropic";

const postSchema = z.object({
  main_post: z
    .string()
    .describe(
      "The main content of the post. Should NOT include the URL, but it should include a concise callout indicating the URL is in the reply.",
    ),
  reply_post: z
    .string()
    .describe(
      "The reply to the Tweet. This should contain a very concise callout (e.g. 'Check out the repo here:'), and the URL.",
    ),
});

const REWRITE_WITH_SPLIT_URL_PROMPT = `You're an advanced AI marketer who has been tasked with splitting a social media post into two unique posts:
1. The first is the main body of the post. You should NOT make any changes to the input, EXCEPT for replacing the callout URL at the bottom, with a message indicating the URL is in the reply.
You may include an emoji to indicate the URL is in the reply.
Example:
"Repo link in reply 👇"
or
"Video link in reply 🧵"
2. The second is the reply post. This should contain a very concise callout (e.g. 'Check out the repo here:'), and the URL.
Example:
"Checkout the repo here: https://github.com/bracesproul/langchain-ai"

Given the following post:
{POST}

Please split it into the two unique posts. Ensure the ONLY modification you make is to the callout & URL at the end of the post.`;

export async function rewritePostWithSplitUrl(
  state: GeneratePostState,
): Promise<GeneratePostUpdate> {
  const postModel = new ChatAnthropic({
    model: "claude-3-7-sonnet-latest",
    temperature: 0,
  }).bindTools(
    [
      {
        name: "rewrite_post",
        description:
          "Rewrite the post with the split URL from the main post content to the reply",
        schema: postSchema,
      },
    ],
    {
      tool_choice: "rewrite_post",
    },
  );

  const formattedPrompt = REWRITE_WITH_SPLIT_URL_PROMPT.replace(
    "{POST}",
    state.post || "",
  );

  const result = await postModel.invoke([
    {
      role: "user",
      content: formattedPrompt,
    },
  ]);

  const rewrittenPost = result.tool_calls?.[0].args as
    | z.infer<typeof postSchema>
    | undefined;

  return {
    complexPost: rewrittenPost,
  };
}
