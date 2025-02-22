import { z } from "zod";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post/generate-post-state.js";
import { ChatAnthropic } from "@langchain/anthropic";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyContentAnnotation } from "../shared-state.js";
import { getVideoSummary } from "../youtube/video-summary.js";

type VerifyYouTubeContentReturn = {
  relevantLinks: (typeof GeneratePostAnnotation.State)["relevantLinks"];
  pageContents: (typeof GeneratePostAnnotation.State)["pageContents"];
};

const VERIFY_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee.
You're given a summary/report on some content a third party submitted to you in hopes of having it promoted by you.
You need to verify if the content is relevant to the following context before approving or denying the request.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

Given this context, examine the summary/report closely, and determine if the content is relevant to your company's products.
You should provide reasoning as to why or why not the content is relevant to your company's products, then a simple true or false for whether or not it's relevant.
`;

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the content is or isn't relevant to your company's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the content is relevant to your company's products.",
      ),
  })
  .describe("The relevancy of the content to your company's products.");

async function verifyYouTubeContentIsRelevant(
  summary: string,
): Promise<boolean> {
  const relevancyModel = new ChatAnthropic({
    model: "claude-3-5-sonnet-latest",
    temperature: 0,
  }).withStructuredOutput(RELEVANCY_SCHEMA, {
    name: "relevancy",
  });

  const { relevant } = await relevancyModel
    .withConfig({
      runName: "check-video-relevancy-model",
    })
    .invoke([
      {
        role: "system",
        content: VERIFY_RELEVANT_CONTENT_PROMPT,
      },
      {
        role: "user",
        content: summary,
      },
    ]);
  return relevant;
}

/**
 * Verifies the content provided is relevant to your company's products.
 */
export async function verifyYouTubeContent(
  state: typeof VerifyContentAnnotation.State,
  _config: LangGraphRunnableConfig,
): Promise<VerifyYouTubeContentReturn> {
  const { summary, thumbnail } = await getVideoSummary(state.link);
  const relevant = await verifyYouTubeContentIsRelevant(summary);

  if (relevant) {
    return {
      relevantLinks: [state.link],
      pageContents: [summary as string],
      ...(thumbnail ? { imageOptions: [thumbnail] } : {}),
    };
  }

  // Not relevant, return empty arrays so this URL is not included.
  return {
    relevantLinks: [],
    pageContents: [],
  };
}
