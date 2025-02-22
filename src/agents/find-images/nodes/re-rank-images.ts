import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { FindImagesAnnotation } from "../find-images-graph.js";
import { chunkArray } from "../../utils.js";
import { getImageMessageContents } from "../../../utils/image-message.js";

const RE_RANK_IMAGES_PROMPT = `You're a highly regarded marketing employee, working on crafting thoughtful and engaging content for your company's LinkedIn and Twitter pages.

You're writing a post, and in doing so you've found a series of images that you think will help make the post more engaging.

Your task is to re-rank these images in order of which you think is the most engaging and best for the post.

Here is the marketing report the post was generated based on:
<report>
{REPORT}
</report>

And here's the actual post:
<post>
{POST}
</post>

Now, given this context, re-rank the images in order of most relevant to least relevant.

Provide your response in the following format:
1. <analysis> tag: Briefly explain your thought process for each image, referencing specific elements from the post and report and why each image is or isn't as relevant as others.
2. <reranked-indices> tag: List the indices of the relevant images in order of most relevant to least relevant, separated by commas.

Example: You're given 5 images, and deem that the relevancy order is [2, 0, 1, 4, 3], then you would respond as follows:
<answer>
<analysis>
- Image 2 is (explanation here)
- Image 0 is (explanation here)
- Image 1 is (explanation here)
- Image 4 is (explanation here)
- Image 3 is (explanation here)
</analysis>
<reranked-indices>
2, 0, 1, 4, 3
</reranked-indices>
</answer>

Ensure you ALWAYS WRAP your analysis and relevant indices inside the <analysis> and <reranked-indices> tags, respectively. Do not only prefix, but ensure they are wrapped completely.

Provide your complete response within <answer> tags.`;

export function parseResult(result: string): number[] {
  const match = result.match(
    /<reranked-indices>\s*([\d,\s]*?)\s*<\/reranked-indices>/s,
  );
  if (!match) return [];

  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => !isNaN(n));
}

export async function reRankImages(state: typeof FindImagesAnnotation.State) {
  // No need to re-rank if less than 2 images
  if (state.imageOptions && state.imageOptions.length < 2) {
    return {
      imageOptions: state.imageOptions,
    };
  }

  const model = new ChatVertexAI({
    model: "gemini-2.0-flash-exp",
    temperature: 0,
  });

  // Split images into chunks of 5
  const imageChunks = chunkArray(state.imageOptions || [], 5);
  let reRankedIndices: number[] = [];
  let baseIndex = 0;

  const formattedSystemPrompt = RE_RANK_IMAGES_PROMPT.replace(
    "{POST}",
    state.post,
  ).replace("{REPORT}", state.report);

  // Process each chunk
  for (const imageChunk of imageChunks) {
    const imageMessages = await getImageMessageContents(imageChunk, baseIndex);

    if (!imageMessages.length) {
      continue;
    }

    try {
      const response = await model.invoke([
        {
          role: "system",
          content: formattedSystemPrompt,
        },
        {
          role: "user",
          content: imageMessages,
        },
      ]);

      const chunkAnalysis = parseResult(response.content as string);
      // Convert chunk indices to global indices and add to our list of re-ranked indices
      const globalIndices = chunkAnalysis.map((index) => index + baseIndex);
      reRankedIndices = [...reRankedIndices, ...globalIndices];
    } catch (error) {
      console.error(
        `Failed to re-rank images.\nImage URLs: ${imageMessages
          .filter((m) => m.fileUri)
          .map((m) => m.fileUri)
          .join(", ")}\n\nError:`,
        error,
      );
      // Add all indices from the failed chunk to allIrrelevantIndices
      const failedChunkIndices = Array.from(
        { length: imageChunk.length },
        (_, i) => i + baseIndex,
      );
      reRankedIndices = [...reRankedIndices, ...failedChunkIndices];
    }

    baseIndex += imageChunk.length;
  }

  if (reRankedIndices.length !== state.imageOptions?.length) {
    console.warn(
      "Re-ranked indices length does not match image options length. Returning original image options.",
    );
    return {
      imageOptions: state.imageOptions,
    };
  }

  const imageOptionsInOrder = reRankedIndices.map(
    (index) => state.imageOptions?.[index],
  );

  return {
    imageOptions: imageOptionsInOrder,
  };
}
