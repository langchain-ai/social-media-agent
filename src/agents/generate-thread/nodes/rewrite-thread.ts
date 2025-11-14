import { z } from "zod";
import { GenerateThreadState } from "../state.js";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  getThreadReflections,
  THREAD_REFLECTIONS_PROMPT,
  THREAD_RULESET_KEY,
} from "../../../utils/reflections.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

const REWRITE_THREAD_PROMPT = `<context>
You're a highly regarded marketing employee, working on crafting thoughtful and engaging content for your LinkedIn and Twitter pages.
You wrote a thread for your LinkedIn and Twitter pages, however your boss has asked for some changes to be made before it can be published.
You're also be provided with the original plan for the thread which you wrote.
Use this plan to guide your decisions, however ensure you weigh the user's requests above the plan if they contradict each other.
</context>

<original-thread>
{originalThread}
</original-thread>

{reflectionsPrompt}

<original-thread-plan>
{originalThreadPlan}
</original-thread-plan>

<instructions>
Listen to your boss closely, and make the necessary changes to the thread.
Ensure you keep the reflections above in mind when making the changes.
You should ONLY update the posts which the user has requested to be updated.
If it is not clear which posts should be updated, you should do your best to determine which posts they intend to update.
You should respond with ALL of the posts, including updated and unchanged posts.
</instructions>`;

const schema = z
  .object({
    threadPosts: z
      .array(
        z.object({
          index: z.number().describe("The index of the post in the thread."),
          text: z
            .string()
            .describe("The text content of the individual post in the thread."),
        }),
      )
      .describe("The list of updated thread posts."),
  })
  .describe("The updated thread posts.");

export async function rewriteThread(
  state: GenerateThreadState,
  config: LangGraphRunnableConfig,
): Promise<Partial<GenerateThreadState>> {
  if (!state.threadPosts?.length) {
    throw new Error("No thread found. Can not rewrite thread without posts.");
  }
  if (!state.userResponse) {
    throw new Error(
      "No user response found. Can not rewrite thread without a response.",
    );
  }

  const rewriteThreadModel = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  }).withStructuredOutput(schema, {
    name: "rewriteThreadPosts",
  });

  const threadReflections = await getThreadReflections(config);
  let threadReflectionsPrompt = "";
  if (
    threadReflections?.value?.[THREAD_RULESET_KEY]?.length &&
    Array.isArray(threadReflections?.value?.[THREAD_RULESET_KEY])
  ) {
    const rulesetString = `- ${threadReflections.value[THREAD_RULESET_KEY].join("\n- ")}`;
    threadReflectionsPrompt = THREAD_REFLECTIONS_PROMPT.replace(
      "{reflections}",
      rulesetString,
    );
  }

  const formattedSystemPrompt = REWRITE_THREAD_PROMPT.replace(
    "{originalThread}",
    state.threadPosts
      .map((p) => `<post index="${p.index}">\n${p.text}\n</post>`)
      .join("\n"),
  )
    .replace("{originalThreadPlan}", state.threadPlan)
    .replace("{reflections}", threadReflectionsPrompt);

  const revisedThreadResponse = await rewriteThreadModel.invoke([
    {
      role: "system",
      content: formattedSystemPrompt,
    },
    {
      role: "user",
      content: state.userResponse,
    },
  ]);

  return {
    threadPosts: revisedThreadResponse.threadPosts,
    next: undefined,
    userResponse: undefined,
  };
}
