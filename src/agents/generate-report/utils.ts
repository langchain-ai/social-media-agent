import { BaseMessageLike } from "@langchain/core/messages";

export function formatImageMessages(imageOptions: string[]): BaseMessageLike {
  return {
    role: "user",
    content: [
      {
        type: "text",
        text: "The following are images you should use as context when extracting key details. All of the following images were extracted from the content you are also provided with.",
      },
      ...imageOptions.map((url) => ({
        type: "image_url",
        image_url: {
          url,
        },
      })),
    ],
  };
}
