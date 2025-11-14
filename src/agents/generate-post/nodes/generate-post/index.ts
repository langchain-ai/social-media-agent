import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { ChatAnthropic } from "@langchain/anthropic";
import { GENERATE_POST_PROMPT } from "./prompts.js";
import { formatPrompt, parseGeneration } from "./utils.js";
import { ALLOWED_TIMES } from "../../constants.js";
import {
  getReflectionsPrompt,
  REFLECTIONS_PROMPT,
} from "../../../../utils/reflections.js";
import { getNextSaturdayDate } from "../../../../utils/date.js";

export async function generatePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.report) {
    throw new Error("No report found");
  }
  if (!state.relevantLinks?.length) {
    throw new Error("No relevant links found");
  }
  const postModel = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0.5,
  });

  const prompt = formatPrompt(state.report, state.relevantLinks);

  const reflections = await getReflectionsPrompt(config);
  const reflectionsPrompt = REFLECTIONS_PROMPT.replace(
    "{reflections}",
    reflections,
  );

  const generatePostPrompt = GENERATE_POST_PROMPT.replace(
    "{reflectionsPrompt}",
    reflectionsPrompt,
  );

  const postResponse = await postModel.invoke([
    {
      role: "system",
      content: generatePostPrompt,
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  // Randomly select a time from the allowed times
  const [postHour, postMinute] = ALLOWED_TIMES[
    Math.floor(Math.random() * ALLOWED_TIMES.length)
  ]
    .split(" ")[0]
    .split(":");
  const postDate = getNextSaturdayDate(Number(postHour), Number(postMinute));

  return {
    post: parseGeneration(postResponse.content as string),
    scheduleDate: postDate,
  };
}
