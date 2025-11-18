import { ChatAnthropic } from "@langchain/anthropic";
import { CurateDataState } from "../state.js";
import { z } from "zod";
import { chunkArray } from "../../utils.js";
import { TweetV2 } from "twitter-api-v2";

const EXAMPLES = `<example index="0">
    <example-tweet>
      RT @arjunkhemani: .@naval: Looking for truth is the opposite of looking for social approval.\n\n“I’m deeply suspicious of groups of people co…
    </example-tweet>

    <scratchpad>
      This tweet is not relevant because it has no mentions of AI, or valuable content for learning.
    </scratchpad>
    is_relevant: false
  </example>

  <example index="0">
    <example-tweet>
      Blog post for Transformer²: Self-Adaptive LLMs\n\nhttps://t.co/AyeFdqEKsd\n\nEventually, neural network weights should be as adaptive as the Octopus 🐙\nhttps://t.co/me7urXJ6BS
    </example-tweet>

    <scratchpad>
      This tweet is relevant because it is about AI, and contains links to blog posts which are most likely about AI.
    </scratchpad>
    is_relevant: true
  </example>

  <example index="0">
    <example-tweet>
      @karpathy @martin_casado Sir, how do I convince my talented ex-big tech SDE peers to use LLMs more for coding\n\nalmost all of them cite privacy/security concerns or hallucinations
    </example-tweet>

    <scratchpad>
      This tweet is not relevant because it does not have enough AI content for learning, but rather it's presenting a question about AI.
    </scratchpad>
    is_relevant: false
  </example>

  <example index="0">
    <example-tweet>
      Aligning Instruction Tuning with Pre-training\n\nDetermines differences between pretraining corpus and SFT corpus and generates instruction data for the difference set. Evaluations on three fully\nopen LLMs across eight benchmarks demonstrate\nconsistent performance improvements. https://t.co/1jJxiv5q2T
    </example-tweet>

    <scratchpad>
      This tweet is relevant because it appears to be referencing a research paper on AI.
    </scratchpad>
    is_relevant: true
  </example>

  <example index="0">
    <example-tweet>
      Btw, your docs are likely AI generated, GAIA is not about environmental and sustainability at all 🤣
    </example-tweet>

    <scratchpad>
      This tweet is not relevant. Although it does mention AI, the tweet itself has no content for learning, or writing educational AI content. Instead it's dissing someone's (alleged) poor documentation.
    </scratchpad>
    is_relevant: false
  </example>

  <example index="0">
    <example-tweet>
      Prompt Engineers at Work 🍰👷🎨\n\nExclusive merch only available for the PromptLayer team... but good news is that we are hiring! https://t.co/X9aJO95RQp
    </example-tweet>

    <scratchpad>
      This tweet is not relevant because it is promoting a non-software product.
    </scratchpad>
    is_relevant: false
  </example>`;

const VALIDATE_BULK_TWEETS_PROMPT = `You are an AI assistant tasked with curating a dataset of tweets about AI. Your job is to review a series of tweets and determine which ones are relevant to AI, LLMs, and related topics. The tweets are provided from a 'Twitter List' of users who primarily tweet about AI.

Here are the rules for determining whether a tweet is relevant:
1. The tweet discusses AI, LLMs, or anything interesting related to AI.
2. The tweet is a retweet of content about AI, LLMs, or anything interesting related to AI.
3. The tweet mentions a research paper on AI, LLMs, or related topics.
4. The tweet is about a new product, tool, or service related to AI, LLMs, or anything interesting related to AI.
5. The tweet references a blog post, video, or other content related to AI, LLMs, or anything interesting related to AI.

Additionally, ensure that the tweet has enough content to be interesting and engaging. Avoid short tweets that merely reference AI without providing substantial information that could be used to create longer content or posts about AI.
The tweets you do approve will be used to create educational content about AI, so ensure the tweets approved are high quality, engaging, and informative.

You will be provided with a list of tweets, each associated with an index number. Your task is to analyze these tweets and identify which ones are relevant according to the rules above.

Use the following examples to guide your analysis:
<analysis-examples>
${EXAMPLES}
</analysis-examples>

Here are the tweets to analyze:
<tweets>
{TWEETS}
</tweets>

Use a scratchpad to analyze each tweet independently. In your scratchpad, briefly explain why each tweet is relevant or not relevant based on the rules provided. Then, create a list of the index numbers for the relevant tweets.
Remember, we only want the highest quality AI tweets, so you should lean towards NOT including a tweet unless it is clearly highly relevant, and would be useful when writing educational content about AI.

<scratchpad>
[Analyze each tweet here, explaining your reasoning]
</scratchpad>

After your analysis, provide your final answer to the 'answer' tool.
Remember, there will be times when all of the tweets are NOT relevant. In this case, do not be worried and simply answer with an empty array.
I won't be upset with you if you don't find any relevant tweets, however I WILL be upset if you mark tweets as relevant which are NOT actually relevant.

Begin!`;

const answerSchema = z
  .object({
    answer: z
      .array(z.number())
      .describe("The index numbers of the relevant tweets."),
  })
  .describe("Your final answer to what tweets are relevant.");

function formatTweets(tweets: TweetV2[]): string {
  return tweets
    .map((t, index) => {
      const fullText = t.note_tweet?.text || t.text || "";
      return `<tweet index="${index}">\n${fullText}\n</tweet>`;
    })
    .join("\n");
}

/**
 * Validates a batch of tweets to determine which ones are relevant to AI-related topics.
 * This function processes tweets in chunks of 25 and uses Claude 3 Sonnet to analyze each tweet
 * against a set of predefined relevance criteria.
 *
 * The relevance criteria includes:
 * - Discussions about AI, LLMs, or AI-related topics
 * - Retweets of AI-related content
 * - Mentions of AI research papers
 * - Information about AI products, tools, or services
 * - References to AI-related blog posts, videos, or other content
 *
 * @param {CurateDataState} state - The current state containing tweets to be validated
 * @returns {Promise<Partial<CurateDataState>>} A promise that resolves to an updated state
 *                                                 containing only the relevant tweets
 */
export async function validateBulkTweets(
  state: CurateDataState,
): Promise<Partial<CurateDataState>> {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  }).withStructuredOutput(answerSchema, { name: "answer" });

  // Chunk the tweets into groups of 25
  const chunkedTweets = chunkArray(state.rawTweets, 25);
  const allRelevantTweets: TweetV2[] = [];

  for (const chunk of chunkedTweets) {
    const formattedPrompt = VALIDATE_BULK_TWEETS_PROMPT.replace(
      "{TWEETS}",
      formatTweets(chunk),
    );

    const { answer } = await model.invoke([["user", formattedPrompt]]);

    const answerSet = new Set(answer);
    const relevantTweets = chunk.filter((_, index) => answerSet.has(index));
    if (relevantTweets.length !== answer.length) {
      console.warn(
        `Expected ${answer.length} relevant tweets, but found ${relevantTweets.length}`,
      );
    }
    allRelevantTweets.push(...relevantTweets);
  }

  return {
    validatedTweets: allRelevantTweets,
  };
}
