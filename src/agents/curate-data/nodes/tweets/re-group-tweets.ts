import { getChatModel } from "../../../../utils/llm.js";
import { CurateDataState } from "../../state.js";
import { GROUP_BY_CONTENT_CRITERIA } from "./prompts.js";
import { TweetsGroupedByContent, TweetV2WithURLs } from "../../types.js";

const RE_GROUP_TWEETS = `You're an advanced AI software engineer who's working on curating education content about AI. A previous step your colleague took was to group tweets about AI, LLMs, and related software into unique topics. After this, a third party identified potential issues with some of the groups.
These groups which will be provided to you MAY need to be combined, or separated. Your task is to carefully review each group, and the tweets within each group. After this, inspect them all in the context of the entire list of groups passed to you.
Then, either re-group the tweets, combine groups, or do nothing if you deem the groups to be fine as is.

Use the following criteria to group tweets:
${GROUP_BY_CONTENT_CRITERIA}

Think carefully before you make a decision. Always provide a detailed explanation of your decision, and why you think it is appropriate.

If you deem no changes to be necessary, stop here and simply respond with "No changes needed".

If you do decide to re-group the tweets, you MUST respond with ALL of the tweets in new, existing, or updated groups. Any tweets which are NOT included in your response WILL be IGNORED, and left out (this is NOT what we want, since these tweets have already been flagged as relevant).

You should respond in the following format:
The entire response should be wrapped inside <answer> tags.
Each subgroup should be wrapped inside <group> tags.
Inside each <group> tag, you should have an <explanation> tag containing a short explanation of the topic of the group. Do not reference the old explanations, or describe why the group was split/joined. ONLY include the detailed explanation of the tweets in the group.
Additionally, include the <tweet-index-list> tag, which should contain a comma-separated list of the indices of the tweets to include in the group.
These indices should be formatted as group:tweet_index, where group is the index of the group in the original list, and tweet_index is the index of the tweet in the original group.

Follow the formatting instructions carefully, and ensure all of your XML tags are properly closed and balanced.

Begin!`;

function formatTweetsInGroup(tweets: TweetV2WithURLs[]): string {
  const text = tweets
    .map((twt, index) => {
      const tweetText = twt.note_tweet?.text || twt.text || "";
      return `<tweet index="${index}">\n${tweetText}\n</tweet>`;
    })
    .join("\n");

  return `<tweets-in-group>
${text}
</tweets-in-group>`;
}

function formatGroupsPrompt(tweetsGroupedByContent: TweetsGroupedByContent[]) {
  return `<groups-to-inspect>
${tweetsGroupedByContent
  .map(
    (group, index) => `<group index="${index}">
<explanation>${group.explanation}</explanation>
${formatTweetsInGroup(group.tweets)}
</group>`,
  )
  .join("\n")}
</groups-to-inspect>`;
}

function splitGroups(
  tweetsGroupedByContent: TweetsGroupedByContent[],
  similarGroupIndices: number[],
): {
  include: TweetsGroupedByContent[];
  review: TweetsGroupedByContent[];
} {
  const include: TweetsGroupedByContent[] = [];
  const review: TweetsGroupedByContent[] = [];

  tweetsGroupedByContent.forEach((group, index) => {
    if (similarGroupIndices.includes(index)) {
      review.push(group);
    } else {
      include.push(group);
    }
  });

  return {
    include,
    review,
  };
}

/**
 * Parse the LLM generation to extract groups containing explanations and tweet indices.
 * Each group should contain an explanation and a list of tweet indices.
 * @param generation The text generation to parse
 * @returns Array of objects containing explanation and tweet indices, or empty array if parsing fails
 */
function parseGeneration(generation: string): Array<{
  explanation: string;
  tweetIndices: { groupIndex: number; tweetIndex: number }[];
}> {
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
      const tweetIndices = indicesMatch[1].split(",").map((index) => {
        const [groupIdx, tweetIdx] = index
          .trim()
          .split(":")
          .map((num) => parseInt(num.trim()));
        if (isNaN(groupIdx) || isNaN(tweetIdx)) {
          throw new Error(`Invalid index format: ${index}`);
        }
        return { groupIndex: groupIdx, tweetIndex: tweetIdx };
      });

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

export async function reGroupTweets(
  state: CurateDataState,
): Promise<Partial<CurateDataState>> {
  if (state.similarGroupIndices.length === 0) {
    console.warn("No similar groups found. Continuing...");
    return {};
  }

  const model = getChatModel({ model: "o1", streaming: false });

  const { include, review } = splitGroups(
    state.tweetsGroupedByContent,
    state.similarGroupIndices,
  );

  const formattedUserPrompt = `Here are the groups you should inspect:
${formatGroupsPrompt(review)}`;

  const result = await model.invoke([
    ["system", RE_GROUP_TWEETS],
    ["user", formattedUserPrompt],
  ]);

  const parsedResult = parseGeneration(result.content as string);

  const newGroups: TweetsGroupedByContent[] = parsedResult.map((group) => {
    const tweets = group.tweetIndices.flatMap((index) => {
      if (!review[index.groupIndex]) {
        console.warn("Invalid tweet index:", index);
        return [];
      }
      return review[index.groupIndex].tweets[index.tweetIndex];
    });
    return {
      explanation: group.explanation,
      tweets,
    };
  });

  return {
    tweetsGroupedByContent: [...include, ...newGroups],
    similarGroupIndices: [],
  };
}
