import {
  removeQueryParams,
  getMimeTypeFromUrl,
  imageUrlToBuffer,
  BLACKLISTED_MIME_TYPES,
} from "../agents/utils.js";

export async function getImageMessageContents(
  imageChunk: string[],
  baseIndex: number,
) {
  const imageMessagesPromises = imageChunk.flatMap(
    async (fileUri, chunkIndex) => {
      const cleanedFileUri = removeQueryParams(fileUri);
      let mimeType = getMimeTypeFromUrl(fileUri);

      if (!mimeType) {
        try {
          const { contentType } = await imageUrlToBuffer(fileUri);
          if (!contentType) {
            throw new Error("Failed to fetch content type");
          }
          mimeType = contentType;
        } catch (e) {
          console.warn(
            "No mime type found, and failed to fetch content type. File URI:\n",
            fileUri,
            "\nError:\n",
            e,
          );
        }
      }
      if (
        !mimeType ||
        BLACKLISTED_MIME_TYPES.find((mt) => mimeType.startsWith(mt))
      ) {
        return [];
      }

      return [
        {
          type: "text",
          text: `The below image is index ${baseIndex + chunkIndex}`,
        },
        {
          type: "media",
          mimeType,
          fileUri: cleanedFileUri,
        },
      ];
    },
  );
  const imageMessages = (await Promise.all(imageMessagesPromises)).flat();
  return imageMessages;
}
