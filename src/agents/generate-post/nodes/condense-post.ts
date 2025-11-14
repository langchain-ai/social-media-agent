import { ChatAnthropic } from "@langchain/anthropic";
import { GeneratePostAnnotation } from "../generate-post-state.js";
import { parseGeneration } from "./generate-post/utils.js";
import { filterLinksForPostContent, removeUrls } from "../../utils.js";
import {
  REFLECTIONS_PROMPT,
  getReflectionsPrompt,
} from "../../../utils/reflections.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getPrompts } from "../prompts/index.js";

const CONDENSE_POST_PROMPT = `You're a highly skilled marketer at LangChain, working on crafting thoughtful and engaging content for LangChain's LinkedIn and Twitter pages.
You wrote a post for the LangChain LinkedIn and Twitter pages, however it's a bit too long for Twitter, and thus needs to be condensed.

You wrote this marketing report on the content which you used to write the original post:
<report>
{report}
</report>

Here are the relevant links used to create the report. At least ONE should be included in the condensed post.
The links do NOT contribute to the post's length. They are temporarily removed from the post before the length is calculated, and re-added afterwards.
<links>
{links}
</links>

You should not be worried by the length of the link, as that will be shortened before posting. Only focus on condensing the length of the post content itself.

Here are the rules and structure you used to write the original post, which you should use when condensing the post now:
<rules-and-structure>

${getPrompts().postStructureInstructions}

<rules>
${getPrompts().postContentRules}
</rules>

{reflectionsPrompt}

</rules-and-structure>

Given the marketing report, link, rules and structure, please condense the post down to roughly 280 characters (not including the link). The original post was {originalPostLength} characters long.
Ensure you keep the same structure, and do not omit any crucial content outright.

Follow this flow to rewrite the post in a condensed format:

<rewriting-flow>
1. Carefully read over the report, original post provided by the user below, the rules and structure.
2. Write down your thoughts about where and how you can condense the post inside <thinking> tags. This should contain details you think will help make the post more engaging, snippets you think can be condensed, etc. This should be the first text you write.
3. Using all the context provided to you above, the original post, and your thoughts, rewrite the post in a condensed format inside <post> tags. This should be the last text you write.
</rewriting-flow>

Follow all rules and instructions outlined above. The user message below will provide the original post. Remember to have fun while rewriting it! Go!`;

/**
 * Attempts to condense a post if the original generation is longer than 300 characters.
 * @param state The state of the graph
 * @returns A partial state of the graph
 */
export async function condensePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.post) {
    throw new Error("No post found");
  }
  if (!state.report) {
    throw new Error("No report found");
  }
  if (!state.relevantLinks?.length) {
    throw new Error("No relevant links found");
  }

  const originalPostLength = removeUrls(state.post || "").length.toString();

  const reflections = await getReflectionsPrompt(config);
  const reflectionsPrompt = REFLECTIONS_PROMPT.replace(
    "{reflections}",
    reflections,
  );

  const formattedSystemPrompt = CONDENSE_POST_PROMPT.replace(
    "{report}",
    state.report,
  )
    .replace("{links}", filterLinksForPostContent(state.relevantLinks))
    .replace("{originalPostLength}", originalPostLength)
    .replace("{reflectionsPrompt}", reflectionsPrompt);

  const condensePostModel = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0.5,
  });

  const userMessageContent = `Here is the original post:\n\n${state.post}`;

  const condensePostResponse = await condensePostModel.invoke([
    {
      role: "system",
      content: formattedSystemPrompt,
    },
    {
      role: "user",
      content: userMessageContent,
    },
  ]);

  return {
    post: parseGeneration(condensePostResponse.content as string),
    condenseCount: state.condenseCount + 1,
  };
}
