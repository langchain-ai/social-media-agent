import { ChatOpenAI } from "@langchain/openai";
import { GenerateReportState } from "../state.js";
import { GENERATE_REPORT_PROMPT_O1 } from "../prompts.js";
import { TweetsGroupedByContent } from "../../curate-data/types.js";
import { formatImageMessages } from "../utils.js";

interface FormatReportPromptParams {
  pageContents?: string[];
  tweetGroup?: TweetsGroupedByContent;
}

const formatReportPrompt = ({
  pageContents,
  tweetGroup,
}: FormatReportPromptParams): string => {
  let pageContentsText = "";

  if (pageContents?.length) {
    pageContentsText = `<page-contents>
<context>
The following text contains summaries, or entire pages from the content I submitted to you.
Please review the content and generate a report on it
</context>
${pageContents.map((content, index) => `<content index={${index + 1}}>\n${content}\n</content>`).join("\n")}
</page-contents>`;
  }

  let tweetGroupText = "";

  if (tweetGroup) {
    tweetGroupText = `${pageContentsText.length > 0 ? "\n\n" : ""}<tweet-group>
<context>
The following contains a series of tweets I grouped together based on the topic of the tweets.
Here is the explanation I wrote for this group:
${tweetGroup.explanation}
Please review the content${pageContentsText.length > 0 ? ", along with the page contents above," : ""} and generate a report on it
</context>
${tweetGroup.tweets
  .map((tweet, index) => {
    const tweetText = tweet.note_tweet?.text || tweet.text || "";
    return `<tweet index={${index + 1}}>\n${tweetText}\n</tweet>`;
  })
  .join("\n")}
</tweet-group>`;
  }

  return `${pageContentsText}${tweetGroupText}`;
};

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

export async function generateReport(
  state: GenerateReportState,
): Promise<Partial<GenerateReportState>> {
  if (!state.pageContents?.length && !state.tweetGroup) {
    throw new Error(
      "No page contents found. pageContents must be defined to generate a report.",
    );
  }
  const prompt = formatReportPrompt({
    pageContents: state.pageContents,
    tweetGroup: state.tweetGroup,
  });

  const reportO1Model = new ChatOpenAI({
    model: "o1",
    streaming: false,
  });

  const formattedReportPrompt = GENERATE_REPORT_PROMPT_O1.replace(
    "{keyDetails}",
    state.keyReportDetails,
  );

  const imageMessage = state.imageOptions?.length
    ? formatImageMessages(state.imageOptions)
    : undefined;

  const report = await reportO1Model.invoke([
    {
      role: "system",
      content: formattedReportPrompt,
    },
    ...(imageMessage ? [imageMessage] : []),
    {
      role: "user",
      content: prompt,
    },
  ]);

  return {
    reports: [
      {
        report: parseGeneration(report.content as string),
        keyDetails: state.keyReportDetails,
      },
    ],
  };
}
