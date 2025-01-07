import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../generate-post-state.js";
import { LANGCHAIN_PRODUCTS_CONTEXT } from "../prompts.js";
import { getModelFromConfig } from "../../utils.js";

const GENERATE_REPORT_PROMPT = `You are a highly regarded marketing employee at LangChain.
You have been tasked with writing a marketing report on content submitted to you from a third party which uses LangChain's products.
This marketing report will then be used to craft Tweets and LinkedIn posts promoting the content and LangChain products.

Here is some context about the different LangChain products and services:
<langchain-context>
${LANGCHAIN_PRODUCTS_CONTEXT}
</langchain-context>

The marketing report should follow the following structure guidelines. It will be made up of three main sections outlined below:
<structure guidelines>
<part key="1">
This is the introduction and summary of the content. This must include key details such as:
- the name of the content/product/service.
- what the content/product/service does, and/or the problems it solves.
- unique selling points or interesting facts about the content.
- a high level summary of the content/product/service.
</part>

<part key="2">
This section should focus on how the content implements LangChain's products/services. It should include:
- the LangChain product(s) used in the content.
- how these products are used in the content.
- why these products are important to the application.
</part>

<part key="3">
This section should cover any additional details about the content that the first two parts missed. It should include:
- a detailed technical overview of the content.
- interesting facts about the content.
- any other relevant information that may be engaging to readers.
</part>
</structure guidelines>

Follow these rules and guidelines when generating the report:
<rules>
- Focus on subject of the content, and why/how LangChain's product(s) enhance it.
- The final Tweet/LinkedIn post will be developer focused, so ensure the report is technical and detailed.
- Include any relevant links found in the content in the report.
- Include details about what the product does/what problem it solves.
- Use proper markdown styling when formatting the marketing report.
- If possible, keep the post at or under 280 characters (not including the URL) for conciseness.
- Generate the report in English, even if the content submitted is not in English.
<rules>

Lastly, you should use the following process when writing the report:
<writing-process>
- First, read over the content VERY thoroughly.
- Take notes, and write down your thoughts about the content after reading it carefully. These should be interesting insights or facts which you think you'll need later on when writing the final report. This should be the first text you write. ALWAYS perform this step first, and wrap the notes and thoughts inside a "<thinking>" tag.
- Finally, write the report. Use the notes and thoughts you wrote down in the previous step to help you write the report. This should be the second and last text you write. Wrap your report inside a "<report>" tag.
</writing-process>

Do not include any personal opinions or biases in the report. Stick to the facts and technical details.
Your response should ONLY include the marketing report, and no other text.

Given these instructions, examine the users input closely, and generate a marketing report on it.`;

/**
 * Parse the LLM generation to extract the report from inside the <report> tag.
 * If the report can not be parsed, the original generation is returned.
 * @param generation The text generation to parse
 * @returns The parsed generation, or the unmodified generation if it cannot be parsed
 */
function parseGeneration(generation: string): string {
  const reportMatch = generation.match(/<report>([\s\S]*?)<\/report>/);
  if (!reportMatch) {
    console.warn(
      "Could not parse report from generation:\nSTART OF GENERATION\n\n",
      generation,
      "\n\nEND OF GENERATION",
    );
  }
  return reportMatch ? reportMatch[1].trim() : generation;
}

const formatReportPrompt = (pageContents: string[]): string => {
  return `The following text contains summaries, or entire pages from the content I submitted to you. Please review the content and generate a report on it.
${pageContents.map((content, index) => `<Content index={${index + 1}}>\n${content}\n</Content>`).join("\n\n")}`;
};

export async function generateContentReport(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  const reportModel = await getModelFromConfig(config, {
    temperature: 0,
  });

  const prompt = formatReportPrompt(state.pageContents);

  const result = await reportModel.invoke([
    {
      role: "system",
      content: GENERATE_REPORT_PROMPT,
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  return {
    report: parseGeneration(result.content as string),
  };
}
