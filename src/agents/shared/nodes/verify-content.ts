import { ChatAnthropic } from "@langchain/anthropic";
import { traceable } from "langsmith/traceable";
import { z } from "zod";

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the webpage is or isn't relevant to your company's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the webpage is relevant to your company's products.",
      ),
  })
  .describe("The relevancy of the content to your company's products.");

async function verifyContentIsRelevantFunc(
  content: string,
  args: {
    systemPrompt: string;
    schema: z.ZodType<z.infer<typeof RELEVANCY_SCHEMA>>;
  },
): Promise<boolean> {
  const relevancyModel = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
    // TODO: Type casting as any here shouldn't be required...
  }).withStructuredOutput(args.schema as any, {
    name: "relevancy",
  });

  const { relevant } = await relevancyModel.invoke([
    {
      role: "system",
      content: args.systemPrompt,
    },
    {
      role: "user",
      content: content,
    },
  ]);
  return relevant;
}

/**
 * Verifies if the content provided is relevant based on the provided system prompt,
 * using the provided relevancy schema.
 *
 * @param {string} content - The content to verify.
 * @param {object} args - The arguments containing the system prompt and relevancy schema.
 * @param {string} args.systemPrompt - The system prompt to use for verification.
 * @param {z.ZodType<z.infer<typeof RELEVANCY_SCHEMA>>} args.schema - The relevancy schema to use for verification.
 * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether the content is relevant.
 */
export const verifyContentIsRelevant = traceable(verifyContentIsRelevantFunc, {
  name: "verify-content-relevancy",
});
