import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { GENERATE_POST_PROMPT, REFLECTIONS_PROMPT } from "./prompts.js";
import { formatPrompt, parseGeneration } from "./utils.js";
import { ALLOWED_TIMES } from "../../constants.js";
import { getReflections, RULESET_KEY } from "../../../../utils/reflections.js";
import { getNextSaturdayDate } from "../../../../utils/date.js";
import { getModelFromConfig } from "../../../utils.js";

export async function generatePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.report) {
    throw new Error("No report found");
  }
  if (state.relevantLinks.length === 0) {
    throw new Error("No relevant links found");
  }
  const postModel = await getModelFromConfig(config, {
    temperature: 0.5,
  });

  const prompt = formatPrompt(state.report, state.relevantLinks[0]);

  const reflections = await getReflections(config);
  let reflectionsPrompt = "";
  if (
    reflections?.value?.[RULESET_KEY]?.length &&
    Array.isArray(reflections?.value?.[RULESET_KEY])
  ) {
    const rulesetString = `- ${reflections.value[RULESET_KEY].join("\n- ")}`;
    reflectionsPrompt = REFLECTIONS_PROMPT.replace(
      "{reflections}",
      rulesetString,
    );
  }

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
