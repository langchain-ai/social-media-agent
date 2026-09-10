import { getChatModel } from "../../../../utils/llm.js";
import { CurateDataState } from "../../state.js";
import { GROUP_BY_CONTENT_CRITERIA } from "./prompts.js";
import { TweetV2WithURLs, TweetsGroupedByContent } from "../../types.js";

const REFLECT_ON_GROUPS_PROMPT = `You're an advanced AI software engineer who's working on curating education content about AI. Your colleague has taken a large dataset of tweets about AI, LLMs, and related software, and grouped them into a set of unique topics.

He was instructed to group them based on the following criteria:
${GROUP_BY_CONTENT_CRITERIA}

In doing this, he wrote descriptions of each group. Your task is to take a look at all of the descriptions, and the tweets which belong to each group. After inspecting each group, make a decision on if any of the groups should be combined, or updated.
This should be based off of whether or not you think the same model, benchmark, product, tool, etc is being referenced in multiple groups, or if the groups are really different topics altogether.

Your colleague will provide you with the group descriptions, and indices for each group. Carefully review each individually, and then in the context of the entire group, and make your decision.

Remember, the groups provided to you do NOT necessarily have issues, or duplicates, but you should still take a careful look at each group, and make a decision on if you think the groups should be combined, or updated.
> IMPORTANT: You will NOT be penalized for saying no groups are similar.

Think carefully before you make a decision. Always provide a detailed explanation of your decision, and why you think it is appropriate.

You should format your response as follows:
The entire response should be wrapped inside <answer> tags.
Within the <answer> tag, you should have a <similar-groups> tag, containing a comma-separated list of the indices of the groups that you think are similar, and should have a deeper look into.
Ensure you always wrap your tags with proper opening and closing tags. Do not prefix or suffix your response with any other dialog or text.

Follow the instructions carefully. Begin!`;

/**
 * Parse the LLM generation to extract similar group indices from the response
 * @param generation The text generation to parse
 * @returns Object containing array of similar group indices, or empty array if parsing fails
 */
function parseGeneration(generation: string): {
  similarGroupIndices: number[];
} {
  try {
    const answerMatch = generation.match(/<answer>([\s\S]*?)<\/answer>/);
    if (!answerMatch) {
      throw new Error("Missing answer tags in generation");
    }

    const similarGroupsMatch = answerMatch[1].match(
      /<similar-groups>([\s\S]*?)<\/similar-groups>/,
    );
    if (!similarGroupsMatch) {
      throw new Error("Missing similar-groups tags in generation");
    }

    const indices = similarGroupsMatch[1]
      .split(",")
      .map((index) => parseInt(index.trim()))
      .filter((index) => !isNaN(index));

    return { similarGroupIndices: indices };
  } catch (error) {
    console.warn(
      "Could not parse groups from generation:\nSTART OF GENERATION\n\n",
      generation,
      "\n\nEND OF GENERATION",
      "\nError:",
      error,
    );
    return { similarGroupIndices: [] };
  }
}

function formatTweetsInGroup(tweets: TweetV2WithURLs[]): string {
  return tweets
    .map((twt) => {
      const text = twt.note_tweet?.text || twt.text || "";
      return `<tweet>\n${text}\n</tweet>`;
    })
    .join("\n");
}

function formatUserPrompt(
  tweetsGroupedByContent: TweetsGroupedByContent[],
): string {
  return `<all-groups>
${tweetsGroupedByContent
  .map((group, index) => {
    return `<group index="${index}">
<description>
${group.explanation}
</description>
<tweets>
${formatTweetsInGroup(group.tweets)}
</tweets>
</group>`;
  })
  .join("\n")}
</all-groups>`;
}

export async function reflectOnTweetGroups(
  state: CurateDataState,
): Promise<Partial<CurateDataState>> {
  const model = getChatModel({ model: "o1", streaming: false });

  const formattedUserPrompt = `Hi! Here are all of the groups I put together:
${formatUserPrompt(state.tweetsGroupedByContent)}

Thanks for your help!`;

  const result = await model.invoke([
    ["system", REFLECT_ON_GROUPS_PROMPT],
    ["user", formattedUserPrompt],
  ]);

  const parsedResult = parseGeneration(result.content as string);

  if (parsedResult.similarGroupIndices.length === 0) {
    return {};
  }

  return {
    similarGroupIndices: parsedResult.similarGroupIndices,
  };
}
