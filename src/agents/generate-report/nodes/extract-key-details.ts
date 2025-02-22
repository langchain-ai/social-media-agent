import { ChatOpenAI } from "@langchain/openai";
import { GenerateReportState } from "../state.js";
import { EXTRACT_KEY_DETAILS_PROMPT } from "../prompts.js";
import { TweetsGroupedByContent } from "../../curate-data/types.js";
import { formatImageMessages } from "../utils.js";

const formatKeyDetailsPrompt = (
  pageContents: string[],
  tweetGroup: TweetsGroupedByContent | undefined,
): string => {
  let tweetGroupText = "";
  if (tweetGroup) {
    tweetGroupText = `Here is a group of tweets I extracted which are relevant to this content:
<tweet-group>
${tweetGroup.explanation}

${tweetGroup.tweets
  .map((tweet) => {
    const tweetText = tweet.note_tweet?.text || tweet.text || "";
    return `<tweet>\n${tweetText}\n</tweet>`;
  })
  .join("\n\n")}
</tweet-group>
`;
  }

  const pageContentsText =
    pageContents.length > 0
      ? pageContents
          .map(
            (content, index) =>
              `<Content index={${index + 1}}>\n${content}\n</Content>`,
          )
          .join("\n\n")
      : "";

  if (pageContentsText.length > 0) {
    return `The following text contains summaries, or entire pages from the content I submitted to you. Please review the content and extract ALL of the key details from it.
${pageContentsText}

${tweetGroupText}`;
  }

  return tweetGroupText;
};

export async function extractKeyDetails(
  state: GenerateReportState,
): Promise<Partial<GenerateReportState>> {
  if (!state.pageContents?.length && !state.tweetGroup) {
    throw new Error(
      "Missing page contents and tweet group. One of these must be defined to extract key details.",
    );
  }
  const keyDetailsPrompt = formatKeyDetailsPrompt(
    state.pageContents || [],
    state.tweetGroup,
  );

  const model = new ChatOpenAI({
    model: "o1",
    streaming: false,
  });

  const imageMessage = state.imageOptions?.length
    ? formatImageMessages(state.imageOptions)
    : undefined;

  const keyDetailsRes = await model.invoke([
    {
      role: "system",
      content: EXTRACT_KEY_DETAILS_PROMPT,
    },
    ...(imageMessage ? [imageMessage] : []),
    {
      role: "user",
      content: keyDetailsPrompt,
    },
  ]);

  return {
    keyReportDetails: keyDetailsRes.content as string,
  };
}
