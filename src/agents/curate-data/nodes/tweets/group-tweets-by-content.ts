import { getChatModel } from "../../../../utils/llm.js";
import { CurateDataState } from "../../state.js";
import { GROUP_BY_CONTENT_CRITERIA } from "./prompts.js";

const GROUP_BY_CONTENT_PROMPT = `You're an advanced AI software engineer who's working on curating education content about AI.
You're given a dump of Tweets about AI, LLMs, or related software. Your task is to carefully inspect each and every tweet the user provides, thinking about the meaning, context, and significance of each tweet.
Once you're done carefully reading over every tweet, you should group tweets which are talking about the same topic together.

Use the following criteria to group tweets:
${GROUP_BY_CONTENT_CRITERIA}

Ensure you are careful in doing this, as each group will be used to write a specific piece of educational content on the topic of the group.
This means if you create poorly grouped content, the educational content will not be high quality, which we DO NOT WANT!

Think slowly, and carefully. When you are done you should provide your group identifying each tweet by the 'index' property given to you. Ensure you format your response as follows:
The entire response should be wrapped inside <answer> tags.
Each subgroup should be wrapped inside <group> tags.
Inside each <group> tag, you should have an <explanation> tag containing a short explanation of the topic of the group.
Additionally, include the <tweet-index-list> tag, which should contain a comma-separated list of the indices of the tweets in the group, using the same indices provided to you in the original <tweet> list.

Follow the formatting instructions carefully, and ensure all of your XML tags are properly closed and balanced.`;

/**
 * Parse the LLM generation to extract groups containing explanations and tweet indices.
 * Each group should contain an explanation and a list of tweet indices.
 * @param generation The text generation to parse
 * @returns Array of objects containing explanation and tweet indices, or empty array if parsing fails
 */
function parseGeneration(
  generation: string,
): Array<{ explanation: string; tweetIndices: number[] }> {
  try {
    const groups = generation.match(/<group>([\s\S]*?)<\/group>/g) || [];
    return groups.map((group) => {
      const explanationMatch = group.match(
        /<explanation>([\s\S]*?)<\/explanation>/,
      );
      const indicesMatch = group.match(
        /<tweet-index-list>([\s\S]*?)<\/tweet-index-list>/,
      );

      if (!explanationMatch || !indicesMatch) {
        throw new Error("Missing required tags in group");
      }

      const explanation = explanationMatch[1].trim();
      const tweetIndices = indicesMatch[1]
        .split(",")
        .map((index) => parseInt(index.trim()))
        .filter((index) => !isNaN(index));

      return { explanation, tweetIndices };
    });
  } catch (error) {
    console.warn(
      "Could not parse groups from generation:\nSTART OF GENERATION\n\n",
      generation,
      "\n\nEND OF GENERATION",
      "\nError:",
      error,
    );
    return [];
  }
}

export async function groupTweetsByContent(
  state: CurateDataState,
): Promise<Partial<CurateDataState>> {
  const model = getChatModel({ model: "o1", streaming: false });

  const formattedUserPrompt = `Here are the tweets you should inspect, and group:
<all-tweets>
${state.validatedTweets
  .map((twt, index) => {
    const tweetText = twt.note_tweet?.text || twt.text || "";
    if (!tweetText) return "";
    return `<tweet index="${index}">
${tweetText}
</tweet>`;
  })
  .join("\n")}
</all-tweets>`;

  const result = await model.invoke([
    ["system", GROUP_BY_CONTENT_PROMPT],
    ["user", formattedUserPrompt],
  ]);

  const parsedGenerations = parseGeneration(result.content as string);

  if (!parsedGenerations.length) {
    console.warn("No groups found in generation");
    return {};
  }

  // Convert the parsed generations into the expected TweetsGroupedByContent format
  const tweetsGroupedByContent = parsedGenerations.map((group) => ({
    explanation: group.explanation,
    tweets: group.tweetIndices.map((index) => {
      const tweet = state.validatedTweets[index];
      // Extract URLs from tweet entities if they exist
      const external_urls =
        tweet.entities?.urls?.map((url) => url.expanded_url) || [];
      return {
        ...tweet,
        external_urls,
      };
    }),
  }));

  return {
    tweetsGroupedByContent,
  };
}
