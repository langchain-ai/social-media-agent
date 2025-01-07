import {
  Annotation,
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { z } from "zod";
import {
  getReflections,
  putReflections,
  RULESET_KEY,
} from "../../utils/reflections.js";
import { REFLECTION_PROMPT, UPDATE_RULES_PROMPT } from "./prompts.js";
import { getModelFromConfig } from "../utils.js";

const newRuleSchema = z.object({
  newRule: z.string().describe("The new rule to create."),
});

const updateRulesetSchema = z
  .object({
    updatedRuleset: z.array(z.string()).describe("The updated ruleset."),
  })
  .describe("The updated ruleset.");

const ReflectionAnnotation = Annotation.Root({
  /**
   * The original post before edits were made.
   */
  originalPost: Annotation<string>,
  /**
   * The post after edits have been made.
   */
  newPost: Annotation<string>,
  /**
   * The user's response to the interrupt event
   * which triggered the reflection.
   */
  userResponse: Annotation<string>,
});

async function reflection(
  state: typeof ReflectionAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof ReflectionAnnotation.State>> {
  if (!config.store) {
    throw new Error("No store provided");
  }
  const model = await getModelFromConfig(config, {
    temperature: 0,
  });

  const generateNewRuleModel = model.bindTools([
    {
      name: "new_rule",
      description:
        "Create a new rule based on the provided text. Only call this tool if a new rule is needed.",
      schema: newRuleSchema,
    },
  ]);
  const formattedPrompt = REFLECTION_PROMPT.replace(
    "{ORIGINAL_POST}",
    state.originalPost,
  )
    .replace("{NEW_POST}", state.newPost)
    .replace("{USER_RESPONSE}", state.userResponse);

  const result = await generateNewRuleModel.invoke([
    {
      role: "user",
      content: formattedPrompt,
    },
  ]);

  const toolCalls = result.tool_calls || [];
  if (!toolCalls.length) {
    // No new rule needed
    return {};
  }

  const newRule = toolCalls[0].args.newRule as string;
  if (!newRule) {
    // Called tool but didn't return a rule
    return {};
  }

  const existingRules = await getReflections(config);

  if (!existingRules?.value?.[RULESET_KEY]?.length) {
    // No rules exist yet. Create and return early.
    await putReflections(config, [newRule]);
    return {};
  }

  const updateRulesetModel = model.withStructuredOutput(updateRulesetSchema, {
    name: "update_ruleset",
  });
  const updateRulesetPrompt = UPDATE_RULES_PROMPT.replace(
    "{EXISTING_RULES}",
    existingRules?.value[RULESET_KEY].join("\n") || "",
  ).replace("{NEW_RULE}", newRule);
  const updateRulesetResult = await updateRulesetModel.invoke([
    {
      role: "user",
      content: updateRulesetPrompt,
    },
  ]);

  await putReflections(config, updateRulesetResult.updatedRuleset);

  return {};
}

const reflectionWorkflow = new StateGraph(ReflectionAnnotation)
  .addNode("reflection", reflection)
  .addEdge(START, "reflection")
  .addEdge("reflection", END);

export const reflectionGraph = reflectionWorkflow.compile();
reflectionGraph.name = "Reflection Graph";
