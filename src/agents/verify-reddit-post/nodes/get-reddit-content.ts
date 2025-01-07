import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post/generate-post-state.js";
import { LANGCHAIN_PRODUCTS_CONTEXT } from "../../generate-post/prompts.js";
import { z } from "zod";
import { VerifyRedditPostAnnotation } from "../verify-reddit-post-state.js";
import { getModelFromConfig } from "../../utils.js";

/**
 * TODO: Support handling links in the main content of the reddit post
 * TODO: Support screenshots in the main content of the reddit post
 */

type VerifyRedditContentReturn = {
  relevantLinks: (typeof GeneratePostAnnotation.State)["relevantLinks"];
  pageContents: (typeof GeneratePostAnnotation.State)["pageContents"];
};

// TODO: Uncomment when ready to implement
// function getImagesFromPost(post: Record<string, any>) {
//   const images = post.data.children[0].data.media_metadata;
//   const imageUrls: string[] = Object.values(images).flatMap(
//     (item: Record<string, any>) => {
//       const imageUrl = Object.values(item).find(
//         (i) => typeof i === "object" && !Array.isArray(i),
//       )?.u;
//       return imageUrl ? [imageUrl] : [];
//     },
//   );
//   return imageUrls;
// }

/**
 * Iterates over all the data returned and returns the main post and the top 10 replies
 * sorted by upvotes.
 *
 * @param content The data returned from the API call
 * @param maxReplies The maximum number of replies to return
 * @returns The main post and the top 10 replies
 */
export function getPostAndReplies(
  content: Record<string, any>[],
  maxReplies = 10,
) {
  const postTitle = content[0].data.children[0].data.title;
  const post = content[0].data.children[0].data.selftext;

  const sortedReplies: Record<string, any>[] = content[1].data.children
    .sort(
      (a: Record<string, any>, b: Record<string, any>) =>
        b.data.ups - a.data.ups,
    )
    .slice(0, maxReplies);
  const replies = sortedReplies.map((reply: Record<string, any>) => {
    return {
      author: reply.data.author,
      body: reply.data.body,
    };
  });
  return { postTitle, post, replies };
}

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the content from the GitHub repository is or isn't relevant to LangChain's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the content from the GitHub repository is relevant to LangChain's products.",
      ),
  })
  .describe("The relevancy of the content to LangChain's products.");

const VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee at LangChain.
You've been sent a Reddit post by a third party claiming it's relevant and implements LangChain's products.
Your task is to determine whether or not the content actually implements and is relevant to LangChain's products.

You're provided the following context:
- The post title and body
- Up to the top 10 replies by upvotes
- The content of any links in the main post
- Any screenshots/images in the main post.

You're doing this to ensure the content is relevant to LangChain, and it can be used as marketing material to promote LangChain.

LangChain has three main products you should be looking out for:
${LANGCHAIN_PRODUCTS_CONTEXT}

Given this, examine the Reddit post and associated content closely, and determine if it is relevant to LangChain's products.
You should provide reasoning as to why or why not the content implements LangChain's products, then a simple true or false for whether or not it implements some.`;

export async function getRedditPostContent(
  state: typeof VerifyRedditPostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<VerifyRedditContentReturn> {
  const url = new URL(state.link);
  const jsonUrl = `${url.origin}${url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname}.json`;
  const postContents = await fetch(jsonUrl);
  const post = await postContents.json();
  const postAndReplies = getPostAndReplies(post, 10);

  const postAsString = `<post>**${postAndReplies.postTitle}**\n${postAndReplies.post}</post>`;
  const repliesAsString = `<replies>\n${postAndReplies.replies
    .map(
      (reply, idx) =>
        `<reply index="${idx}">**${reply.author}**\n${reply.body}</reply>`,
    )
    .join("\n")}\n</replies>`;

  const relevancyModel = (
    await getModelFromConfig(config, {
      temperature: 0,
    })
  ).withStructuredOutput(RELEVANCY_SCHEMA, {
    name: "relevancy",
  });

  const { relevant } = await relevancyModel
    .withConfig({
      runName: "check-github-relevancy-model",
    })
    .invoke([
      {
        role: "system",
        content: VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT,
      },
      {
        role: "user",
        content: `${postAsString}\n\n${repliesAsString}`,
      },
      // TODO: Add link contents and images!!
    ]);

  if (!relevant) {
    return {
      pageContents: [],
      relevantLinks: [],
    };
  }

  return {
    pageContents: [`${postAsString}\n\n${repliesAsString}`],
    relevantLinks: [state.link],
  };
}
