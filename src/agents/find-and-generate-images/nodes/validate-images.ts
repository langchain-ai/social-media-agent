import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { FindAndGenerateImagesAnnotation } from "../find-and-generate-images-graph.js";
import { chunkArray, imageUrlToBuffer, isValidUrl } from "../../utils.js";
import { getImageMessageContents } from "../../../utils/image-message.js";

const VALIDATE_IMAGES_PROMPT = `You are an advanced AI assistant tasked with validating image options for a social media post.
Your goal is to identify which images from a given set are relevant to the post, based on the content of the post and an associated marketing report.

First, carefully read and analyze the following social media post:

<post>
{POST}
</post>

Now, review the marketing report that was used to generate this post:

<report>
{REPORT}
</report>

To determine which images are relevant, consider the following criteria:
1. Does the image directly illustrate a key point or theme from the post?
2. Does the image represent any products, services, or concepts mentioned in either the post or the report?

You should NEVER include images which are:
- Logos, icons, or profile pictures (unless it is a LangChain/LangGraph/LangSmith logo).
- Personal, or non-essential images from a business perspective.
- Small, low-resolution images. These are likely accidentally included in the post and should be excluded.

You will be presented with a list of image options. Your task is to identify which of these images are relevant to the post based on the criteria above.

Provide your response in the following format:
1. <analysis> tag: Briefly explain your thought process for each image, referencing specific elements from the post and report.
2. <relevant_indices> tag: List the indices of the relevant images, starting from 0, separated by commas.

Ensure you ALWAYS WRAP your analysis and relevant indices inside the <analysis> and <relevant_indices> tags, respectively. Do not only prefix, but ensure they are wrapped completely.

Remember to carefully consider each image in relation to both the post content and the marketing report.
Be thorough in your analysis, but focus on the most important factors that determine relevance.
If an image is borderline, err on the side of inclusion.

Provide your complete response within <answer> tags.
`;

export function parseResult(result: string): number[] {
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

export async function validateImages(
  state: typeof FindAndGenerateImagesAnnotation.State,
): Promise<{
  imageOptions: string[] | undefined;
}> {
  const { imageOptions, report, post } = state;

  const model = new ChatVertexAI({
    model: "gemini-2.5-pro",
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
  let allIrrelevantIndices: number[] = [];
  let baseIndex = 0;

  const formattedSystemPrompt = VALIDATE_IMAGES_PROMPT.replace(
    "{POST}",
    post,
  ).replace("{REPORT}", report);

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
      // Convert chunk indices to global indices and add to our list of relevant indices
      const globalIndices = chunkAnalysis.map((index) => index + baseIndex);
      allIrrelevantIndices = [...allIrrelevantIndices, ...globalIndices];
    } catch (error) {
      console.error(
        `Failed to validate images.\nImage URLs: ${imageMessages
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
      allIrrelevantIndices = [...allIrrelevantIndices, ...failedChunkIndices];
    }

    baseIndex += imageChunk.length;
  }

  const protectedUrls = imageOptions?.filter(
    (fileUri) =>
      (process.env.SUPABASE_URL &&
        fileUri.startsWith(process.env.SUPABASE_URL)) ||
      fileUri.startsWith(YOUTUBE_THUMBNAIL_URL),
  );

  // Keep only the relevant images (those whose indices are in allIrrelevantIndices)
  return {
    imageOptions: [
      ...(protectedUrls || []),
      ...(imagesWithoutProtected || []).filter((_, index) =>
        allIrrelevantIndices.includes(index),
      ),
    ],
  };
}
