import { ChatAnthropic } from "@langchain/anthropic";
import {
  formatAllPostsForPrompt,
  formatBodyPostsForPrompt,
  formatReportsForPrompt,
  formatTweetExamplesForPrompt,
  parseTweetGeneration,
} from "../utils.js";
import { GenerateThreadState } from "../state.js";

const STYLE_RULES = `- Ensure it's engaging and interesting.
- Keep it under 280 characters to fit in a single Tweet.
- Avoid marketing jargon or language. Don't sound like a salesperson, AI, or corporate employee.
- Do NOT use hashtags or emojis.
- Avoid the following and similar phrases, and tactics to get clicks:
  - "let's jump into this 🧵"
  - "read more below"
  - "here's what you need to know"
  - "the numbers are mind-blowing"
  - "The roadmap gets even wilder"
  - "game changing"
  Your facts and numbers should speak for themselves. Including these phrases or similar would make me want to click AWAY since it sounds like a sales pitch, or someone is grifting.
- Your post should sound like it was written by a human.`;

/**
 * Prompt for generating the initial post for the thread.
 */
const FIRST_POST_PROMPT = `You are an expert in social media and marketing, tasked with writing the first post for a Twitter thread. Your goal is to create an engaging, informative, and interesting post that will hook users and get them excited to read the rest of the thread.

Follow these style rules when crafting your initial tweet:
<rules-and-guidelines>
${STYLE_RULES}
- Provide a high-level overview that excites users to read the rest of the posts, rather than covering all points in the plan.
</rules-and-guidelines>

Here are examples of tweets that sound like they were written by humans.
Even though some might be much longer than 280 characters, you should ignore the length and instead focus on the content, wording and tone.
Your main goal is to SOUND like a human, who writes casual and informative tweets:
<tweet-examples>
${formatTweetExamplesForPrompt()}
</tweet-examples>

Here is the plan for the thread:
<thread-plan>
{THREAD_PLAN}
</thread-plan>

And here are the marketing reports to inform your post:
<marketing-reports>
{MARKETING_REPORTS}
</marketing-reports>

Now, follow these steps to create your tweet:

1. Carefully read through the thread plan and marketing reports.
2. Identify the key points or themes that would be most engaging to potential readers.
3. Think about how you can introduce these points in a way that piques curiosity without giving everything away.
4. Craft a tweet that adheres to the guidelines provided earlier, using the information you've gathered.
5. Review your tweet to ensure it's under 280 characters and sounds like it was written by a human.

Once you've completed these steps, provide your tweet inside <tweet> tags. Do not include any explanation or commentary outside of the tweet itself. ALWAYS WRAP your tweet inside opening and closing <tweet> tags.`;

/**
 * Prompt for generating followup posts.
 */
const FOLLOWING_POST_PROMPTS = `You are an expert in social media and marketing, tasked with writing a post for a Twitter thread. Your goal is to create an engaging, informative, and interesting post that will make users want to keep reading the thread.

You've been tasked with writing the body posts for a thread, following the plan provided to you. You're currently writing {CURRENT_POST_NUMBER} in the thread out of {TOTAL_POSTS} (including the first introduction post).

Follow these style rules when crafting your tweet:
<rules-and-guidelines>
${STYLE_RULES}
</rules-and-guidelines>

Here are examples of tweets that sound like they were written by humans.
Even though some might be much longer than 280 characters, you should ignore the length and instead focus on the content, wording and tone.
Your main goal is to SOUND like a human, who writes casual and informative tweets:
<tweet-examples>
${formatTweetExamplesForPrompt()}
</tweet-examples>

Here is the introduction post you already wrote for the thread:
<introduction-post>
{INTRODUCTION_POST}
</introduction-post>

{BODY_POSTS}

Here is the plan for the thread. Ensure you examine closely the plan for the post you're about to write, the post you wrote previously, and if applicable, the post you'll write next.
This is important to keep the entire thread coherent and engaging:
<thread-plan>
{THREAD_PLAN}
</thread-plan>

Now, follow these steps to create your tweet:

1. Carefully read through the thread plan.
2. Identify the key points or themes that would be most engaging to potential readers.
3. Think about how you can introduce these points in a way that piques curiosity without giving everything away.
4. Craft a tweet that adheres to the guidelines provided earlier, using the information you've gathered.
5. Review your tweet to ensure it's under 280 characters and sounds like it was written by a human.

Once you've completed these steps, provide your tweet inside <tweet> tags. Do not include any explanation or commentary outside of the tweet itself. ALWAYS WRAP your tweet inside opening and closing <tweet> tags.`;

/**
 * Prompt for the final post in the thread.
 */
const FINAL_POST_PROMPT = `You are an expert in social media and marketing, tasked with writing the LAST post in a Twitter thread.
Your goal is to write a post which cleanly wraps up the thread.

Follow these style rules when crafting your concluding tweet:
<rules-and-guidelines>
${STYLE_RULES}
- Ensure this tweet wraps up the entire thread.
</rules-and-guidelines>

Here are examples of tweets that sound like they were written by humans.
Even though some might be much longer than 280 characters, you should ignore the length and instead focus on the content, wording and tone.
Your main goal is to SOUND like a human, who writes casual and informative tweets:
<tweet-examples>
${formatTweetExamplesForPrompt()}
</tweet-examples>

Here are all of the posts you've written so far:
<thread-posts>
{THREAD_POSTS}
</thread-posts>

You also wrote this plan for the thread. Ensure you examine the plan closely for the conclusion you're about to write, and all of the posts you wrote previously.
This is important to keep the entire thread coherent and engaging:
<thread-plan>
{THREAD_PLAN}
</thread-plan>

Now, follow these steps to create your tweet:

1. Carefully read through the thread plan.
2. Identify the key points or themes that would be most engaging to potential readers.
3. Think about how you can introduce these points in a way that piques curiosity without giving everything away.
4. Craft a tweet that adheres to the guidelines provided earlier, using the information you've gathered.
5. Review your tweet to ensure it's under 280 characters and sounds like it was written by a human.

Once you've completed these steps, provide your tweet inside <tweet> tags. Do not include any explanation or commentary outside of the tweet itself. ALWAYS WRAP your tweet inside opening and closing <tweet> tags.`;

export async function generateThreadPosts(
  state: GenerateThreadState,
): Promise<Partial<GenerateThreadState>> {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0, // TODO: Eval different temperatures
  });

  const formattedFirstPostPrompt = FIRST_POST_PROMPT.replace(
    "{THREAD_PLAN}",
    state.threadPlan,
  ).replace("{MARKETING_REPORTS}", formatReportsForPrompt(state.reports));
  const firstPostGeneration = await model.invoke([
    ["user", formattedFirstPostPrompt],
  ]);
  const firstPost = parseTweetGeneration(firstPostGeneration.content as string);

  const bodyPosts: string[] = [];

  // Subtract 2 because we already have the first post, and we generate the final post at the end
  for (let i = 0; i < state.totalPosts - 2; i += 1) {
    const formattedFollowingPostPrompt = FOLLOWING_POST_PROMPTS.replace(
      "{CURRENT_POST_NUMBER}",
      i === 0 ? "the first post" : `post no. ${i + 1}`,
    )
      .replace("{TOTAL_POSTS}", state.totalPosts.toString())
      .replace("{INTRODUCTION_POST}", firstPost)
      .replace("{BODY_POSTS}", formatBodyPostsForPrompt(bodyPosts))
      .replace("{THREAD_PLAN}", state.threadPlan);

    const bodyPost = (
      await model.invoke([["user", formattedFollowingPostPrompt]])
    ).content as string;

    bodyPosts.push(parseTweetGeneration(bodyPost));
  }

  const formattedFinalPostPrompt = FINAL_POST_PROMPT.replace(
    "{THREAD_PLAN}",
    state.threadPlan,
  ).replace(
    "{THREAD_POSTS}",
    formatAllPostsForPrompt([firstPost, ...bodyPosts]),
  );

  const finalPostGeneration = await model.invoke([
    ["user", formattedFinalPostPrompt],
  ]);
  const finalPost = parseTweetGeneration(finalPostGeneration.content as string);

  const allPosts = [firstPost, ...bodyPosts, finalPost];
  return {
    threadPosts: allPosts.map((post, index) => ({
      text: post,
      index,
    })),
  };
}
