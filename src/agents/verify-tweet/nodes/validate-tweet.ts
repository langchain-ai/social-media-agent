import { z } from "zod";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyTweetAnnotation } from "../verify-tweet-state.js";
import { skipContentRelevancyCheck } from "../../utils.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { verifyContentIsRelevant } from "../../shared/nodes/verify-content.js";

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

const VERIFY_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee.
You're provided with a Tweet, and the page content of links in the Tweet. This Tweet was sent to you by a third party claiming it's relevant and implements your company's products.
Your task is to carefully read over the entire page, and determine whether or not the content actually implements and is relevant to your company's products.
You're doing this to ensure the content is relevant to your company, and it can be used as marketing material to promote your company.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

Given this context, examine the entire Tweet plus webpage content closely, and determine if the content implements your company's products.
You should provide reasoning as to why or why not the content implements your company's products, then a simple true or false for whether or not it implements some.`;

function constructContext({
  tweetContent,
  pageContents,
}: {
  tweetContent: string;
  pageContents: string[];
}): string {
  const tweetPrompt = `The following is the content of the Tweet:
<tweet-content>
${tweetContent}
</tweet-content>`;
  const webpageContents =
    pageContents.length > 0
      ? `The following are the contents of the webpage${pageContents.length > 1 ? "s" : ""} linked in the Tweet:
${pageContents.map((content, index) => `<webpage-content key="${index}">\n${content}\n</webpage-content>`).join("\n")}`
      : "No webpage content was found in the Tweet.";

  return `${tweetPrompt}\n\n${webpageContents}`;
}

/**
 * Verifies the Tweet & webpage contents provided is relevant to your company's products.
 */
export async function validateTweetContent(
  state: typeof VerifyTweetAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof VerifyTweetAnnotation.State>> {
  if (!state.pageContents?.length && !state.tweetContent) {
    throw new Error(
      "Missing page contents and tweet contents. One of these must be defined to verify the Tweet content.",
    );
  }
  const context = constructContext({
    tweetContent: state.tweetContent,
    pageContents: state.pageContents || [],
  });

  const returnValue = {
    relevantLinks: [state.link, ...state.tweetContentUrls],
    pageContents: [context],
  };

  if (await skipContentRelevancyCheck(config.configurable)) {
    return returnValue;
  }

  if (
    await verifyContentIsRelevant(context, {
      systemPrompt: VERIFY_RELEVANT_CONTENT_PROMPT,
      schema: RELEVANCY_SCHEMA,
    })
  ) {
    return returnValue;
  }

  return {
    relevantLinks: [],
    pageContents: [],
    imageOptions: [],
  };
}
