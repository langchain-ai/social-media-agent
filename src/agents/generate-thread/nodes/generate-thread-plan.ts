import { getChatModel } from "../../../utils/llm.js";
import { formatReportsForPrompt } from "../utils.js";
import { GenerateThreadState } from "../state.js";

const PROMPT = `You're an expert in social media and marketing. Your newest assignment is to create a detailed outline/plan for a Twitter thread.
You're given a single/series of marketing reports on the subject of the thread.

Your task is to analyze the reports, and create a detailed plan for each post in the thread.

Here is some background on the type of posts you've written in the past, and context about your page & audience:
-  The thread should be informative, interesting and engaging.
- You tweet about technical topics, mainly about AI. This means you want your posts to include relevant technical information, but not too much to bore users.
- You write threads which users will actually read and enjoy. Your users finish reading your threads knowing more about the topic, and inspired to take action and learn more, thanks to the posts in the thread.
- Your target audience is AI enthusiasts, software developers, and data scientists.
- Your tone is causal, friendly, engaging and informative. You sound like a friendly AI expert.
- You're a 'thought leader' in the AI space, and want to share your knowledge and insights with your audience.

Your thread should contain between 3 and 10 posts. Each post should be between 150-300 words. Ensure you kep this in mind when planning your posts.

Your plan should include the following sections:

1. Introduction. This is the beginning of your plan, and will act as a high level overview of the rest of your plan.
- A title. This should be short, and convey the main idea of the thread.
- A short introduction. This should concisely explain what the thread will cover, and why you think your audience will care.
- A list of key points to be made in the thread.
- A short, high level summary of each post you plan to write for the thread. This should be short and to the point. Do not make this more than 2-3 short sentences.
  Additionally, ensure you include the TOTAL NUMBER OF POSTS you plan to write in the thread inside <total-posts> opening & closing tags.
  Example: <total-posts>4</total-posts>

2. Body. This is the main body of your plan. It should include detailed information on each post you outlined in the introduction.
Focus on key points made in the report, specific technical details, or other relevant and interesting facts.
Each section of the body should cover one post in the thread. Each section should include the following:
  1. Objective (what does this post specifically aim to convey?)
  2. Key points (bullet them out)
  3. Source/citations (where it comes from in the original reports)
  4. Intended transitions (optional - how this post connects to the next one)

3. Conclusion. This is the final section of your plan. You should summarize the main takeaways from the thread, and include any final notes you want to make about the thread.

The user will provide you with the reports on the subject of the thread.

Ensure you do NOT write the actual posts in this plan. For now, you're only planning the posts. Ensure you respond ONLY with the plan. Do NOT include any prefixing or suffixing dialog.`;

function parseTotalPosts(generation: string): number | undefined {
  const reportMatch = generation.match(
    /<total-posts>([\s\S]*?)<\/total-posts>/,
  );
  if (!reportMatch) {
    console.warn(
      "Could not parse report from generation:\nSTART OF GENERATION\n\n",
      generation,
      "\n\nEND OF GENERATION",
    );
  }

  const totalPosts = reportMatch ? reportMatch[1].trim() : generation;
  if (!totalPosts) {
    return undefined;
  }

  // Check totalPosts is a number
  if (isNaN(parseInt(totalPosts))) {
    console.warn(
      "Could not parse total posts from generation:\nSTART OF GENERATION\n\n",
      generation,
      "\n\nEND OF GENERATION",
    );
    return undefined;
  }

  return Number(totalPosts);
}

export async function generateThreadPlan(
  state: GenerateThreadState,
): Promise<Partial<GenerateThreadState>> {
  const model = getChatModel({
    model: "o1",
    streaming: false,
  });

  const userMessage = `Here are the report(s) you should use to plan the thread:

<all-reports>
${formatReportsForPrompt(state.reports)}
</all-reports>`;

  const response = await model.invoke([
    ["system", PROMPT],
    ["user", userMessage],
  ]);

  const threadPlan = response.content as string;
  const totalPosts = parseTotalPosts(threadPlan);
  if (totalPosts === undefined) {
    // TODO: Make this pass to an LLM and have the LLM extract the number.
    throw new Error("Could not parse total posts from generation");
  }

  return {
    threadPlan,
    totalPosts,
  };
}
