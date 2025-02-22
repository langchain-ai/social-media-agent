import { traceable } from "langsmith/traceable";
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { chunkArray, imageUrlToBuffer, isValidUrl } from "../../utils.js";
import { RepurposerState } from "../types.js";
import { getImageMessageContents } from "../../../utils/image-message.js";

const VALIDATE_IMAGES_PROMPT = `You are an advanced AI assistant tasked with validating image options to be included in context when generating a marketing report for a social media campaign.
Your task is to identify which images extracted from a blog/webpage are relevant to the marketing campaign, and will be useful when writing a marketing report.

First, carefully read and analyze the full text content extracted from the blog/webpage:

<page-contents>
{PAGE_CONTENTS}
</page-contents>

To determine which images are relevant, consider the following criteria:
1. Does the image directly illustrate a key point or theme from the webpage?
2. Does the image represent any products, services, or concepts mentioned throughout the webpage?
3. Is the image highly relevant, or a technical illustration? 

You should NEVER include images which are:
- Only containing logos, icons, or profile pictures.
- Personal, or non-essential images from a business perspective.
- Small, low-resolution images. These are likely accidentally included in the marketing campaign and should be excluded.

You will be presented with a list of image options. Your task is to identify which of these images are relevant to the marketing campaign based on the criteria above.

Provide your response in the following format:
1. <analysis> tag: Briefly explain your thought process for each image, referencing specific elements from the webpage.
2. <relevant_indices> tag: List the indices of the relevant images, starting from 0, separated by commas.

Ensure you ALWAYS WRAP your analysis and relevant indices inside the <analysis> and <relevant_indices> tags, respectively. Do not only prefix, but ensure they are wrapped completely.

Remember to carefully consider each image in relation to the webpage content.
Be thorough in your analysis, but focus on the most important factors that determine relevance.
If an image is borderline, err on the side of inclusion.

Provide your complete response within <answer> tags.
`;

export function parseResult(result: string): number[] {
  if (result.includes("<relevant_indices>")) {
    let relevantIndicesText = "";
    if (result.includes("</relevant_indices>")) {
      relevantIndicesText = result
        .split("<relevant_indices>")[1]
        ?.split("</relevant_indices>")[0]
        ?.replaceAll(" ", "")
        .replaceAll("\n", "");
    } else if (result.includes("</answer>")) {
      relevantIndicesText = result
        .split("<relevant_indices>")[1]
        ?.split("</answer>")[0]
        ?.replaceAll(" ", "")
        .replaceAll("\n", "");
    }

    if (relevantIndicesText?.length) {
      if (!relevantIndicesText.includes(",")) {
        // Add a comma so the code below which parses the string into an array will work.
        relevantIndicesText += ",";
      }

      const indices = relevantIndicesText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map(Number);
      if (indices.length && indices.every((n) => !isNaN(n))) {
        return indices;
      }
    }
  }

  const match = result.match(
    /<relevant_indices>\s*([\d,\s]*?)\s*<\/relevant_indices>/s,
  );
  if (!match) return [];

  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => !isNaN(n));
}

const YOUTUBE_THUMBNAIL_URL = "https://i.ytimg.com/";

function removeProtectedUrls(imageOptions: string[]): string[] {
  return imageOptions.filter(
    (fileUri) =>
      (!process.env.SUPABASE_URL ||
        !fileUri.startsWith(process.env.SUPABASE_URL)) &&
      !fileUri.startsWith(YOUTUBE_THUMBNAIL_URL),
  );
}

function getProtectedUrls(imageOptions: string[]): string[] {
  return imageOptions.filter(
    (fileUri) =>
      (process.env.SUPABASE_URL &&
        fileUri.startsWith(process.env.SUPABASE_URL)) ||
      fileUri.startsWith(YOUTUBE_THUMBNAIL_URL),
  );
}

async function filterImageUrls(imageOptions: string[]): Promise<{
  imageOptions: string[];
  returnEarly: boolean;
}> {
  const imagesWithoutProtected = imageOptions?.length
    ? removeProtectedUrls(imageOptions)
    : [];

  if (!imagesWithoutProtected?.length) {
    return {
      imageOptions,
      returnEarly: true,
    };
  }

  const validImageUrlPromises = imagesWithoutProtected.filter(
    async (imgUrl) => {
      if (!isValidUrl(imgUrl)) return false;

      try {
        // Use this as a way to validate the image exists
        const { contentType } = await imageUrlToBuffer(imgUrl);
        if (contentType.startsWith("image/")) {
          return true;
        }
      } catch (_) {
        // no-op
      }
      return false;
    },
  );

  const validImageUrls = await Promise.all(validImageUrlPromises);
  if (!validImageUrls.length) {
    const protectedImageUrls = imageOptions?.length
      ? getProtectedUrls(imageOptions)
      : [];
    return {
      imageOptions: [...protectedImageUrls],
      returnEarly: true,
    };
  }

  return {
    imageOptions: validImageUrls,
    returnEarly: false,
  };
}

const extractIndicesFromText = traceable(
  (text: string): number[] => {
    const chunkAnalysis = parseResult(text);
    return chunkAnalysis;
  },
  {
    name: "extractIndicesFromText",
  },
);

export async function validateImages(state: RepurposerState): Promise<{
  imageOptions: string[] | undefined;
}> {
  const { imageOptions, originalContent } = state;

  const model = new ChatVertexAI({
    model: "gemini-2.0-pro-exp-02-05",
    temperature: 0,
  });

  const { imageOptions: imagesWithoutProtected, returnEarly } =
    await filterImageUrls(imageOptions ?? []);

  if (returnEarly || !imagesWithoutProtected?.length) {
    return {
      imageOptions: imagesWithoutProtected,
    };
  }

  // Split images into chunks of 10
  const imageChunks = chunkArray(imagesWithoutProtected, 10);
  let allRelevantIndices: number[] = [];
  let baseIndex = 0;

  const formattedSystemPrompt = VALIDATE_IMAGES_PROMPT.replace(
    "{PAGE_CONTENTS}",
    originalContent,
  );

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

      allRelevantIndices = [
        ...allRelevantIndices,
        ...(await extractIndicesFromText(response.content as string)),
      ];
    } catch (error) {
      console.error(
        `Failed to validate images.\nImage URLs: ${imageMessages
          .filter((m) => m.fileUri)
          .map((m) => m.fileUri)
          .join(", ")}\n\nError:`,
        error,
      );
    }

    baseIndex += imageChunk.length;
  }

  const protectedUrls = imageOptions?.filter(
    (fileUri) =>
      (process.env.SUPABASE_URL &&
        fileUri.startsWith(process.env.SUPABASE_URL)) ||
      fileUri.startsWith(YOUTUBE_THUMBNAIL_URL),
  );

  // Keep only the relevant images (those whose indices are in allRelevantIndices)
  return {
    imageOptions: [
      ...(protectedUrls || []),
      ...(imagesWithoutProtected || []).filter((_, index) =>
        allRelevantIndices.some((i) => i === index),
      ),
    ],
  };
}
