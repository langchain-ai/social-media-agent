import { z } from "zod";
import { LANGCHAIN_PRODUCTS_CONTEXT } from "../../generate-post/prompts.js";
import { VerifyTweetAnnotation } from "../verify-tweet-state.js";
import { getModelFromConfig } from "../../utils.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the webpage is or isn't relevant to LangChain's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the webpage is relevant to LangChain's products.",
      ),
  })
  .describe("The relevancy of the content to LangChain's products.");

const VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee at LangChain.
You're provided with a Tweet, and the page content of links in the Tweet. This Tweet was sent to you by a third party claiming it's relevant and implements LangChain's products.
Your task is to carefully read over the entire page, and determine whether or not the content actually implements and is relevant to LangChain's products.
You're doing this to ensure the content is relevant to LangChain, and it can be used as marketing material to promote LangChain.

For context, LangChain has three main products you should be looking out for:
${LANGCHAIN_PRODUCTS_CONTEXT}

Given this context, examine the entire Tweet plus webpage content closely, and determine if the content implements LangChain's products.
You should provide reasoning as to why or why not the content implements LangChain's products, then a simple true or false for whether or not it implements some.`;

async function verifyGeneralContentIsRelevant(
  content: string,
  config: LangGraphRunnableConfig,
): Promise<boolean> {
  const relevancyModel = (
    await getModelFromConfig(config, {
      temperature: 0,
    })
  ).withStructuredOutput(RELEVANCY_SCHEMA, {
    name: "relevancy",
  });

  const { relevant } = await relevancyModel
    .withConfig({
      runName: "check-general-relevancy-model",
    })
    .invoke([
      {
        role: "system",
        content: VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT,
      },
      {
        role: "user",
        content: content,
      },
    ]);
  return relevant;
}

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
 * Verifies the Tweet & webpage contents provided is relevant to LangChain products.
 */
export async function validateTweetContent(
  state: typeof VerifyTweetAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof VerifyTweetAnnotation.State>> {
  const context = constructContext({
    tweetContent: state.tweetContent,
    pageContents: state.pageContents,
  });

  const relevant = await verifyGeneralContentIsRelevant(context, config);

  if (!relevant) {
    return {
      relevantLinks: [],
      pageContents: [],
      imageOptions: [],
    };
  }

  return {
    relevantLinks: [state.link],
    pageContents: [context],
  };
}
