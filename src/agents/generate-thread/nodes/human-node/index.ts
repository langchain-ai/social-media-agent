import { END, LangGraphRunnableConfig, interrupt } from "@langchain/langgraph";
import { ThreadPost } from "../../types.js";
import { GenerateThreadState } from "../../state.js";
import {
  getNextSaturdayDate,
  parseDateResponse,
} from "../../../../utils/date.js";
import { formatInTimeZone } from "date-fns-tz";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";
import { processImageInput } from "../../../utils.js";
import { routeResponse } from "../../../shared/nodes/route-response.js";

interface ConstructDescriptionArgs {
  unknownResponseDescription: string;
  threadPosts: ThreadPost[];
  imageOptions?: string[];
}

function constructDescription({
  unknownResponseDescription,
  imageOptions,
  threadPosts,
}: ConstructDescriptionArgs): string {
  const imageOptionsText = imageOptions?.length
    ? `## Image Options\n\nThe following image options are available. Select one by copying and pasting the URL into the 'image' field.\n\n${imageOptions.map((url) => `URL: ${url}\nImage: <details><summary>Click to view image</summary>\n\n![](${url})\n</details>\n`).join("\n")}`
    : "";

  const unknownResponseString = unknownResponseDescription
    ? `${unknownResponseDescription}\n\n`
    : "";

  const imageInstructionsString = imageOptions?.length
    ? `If you wish to attach an image to the post, please add a public image URL.

You may remove the image by setting the 'image' field to 'remove', or by removing all text from the field
To replace the image, simply add a new public image URL to the field.

MIME types will be automatically extracted from the image.
Supported image types: \`image/jpeg\` | \`image/gif\` | \`image/png\` | \`image/webp\``
    : "No image options available.";

  return `${unknownResponseString}# Schedule post
  
### Post:
\`\`\`
${threadPosts.map((p) => `${p.index}\n${p.text}`).join("\n---\n")}
\`\`\`

${imageOptionsText}

## Instructions

There are a few different actions which can be taken:\n
- **Edit**: If the post is edited and submitted, it will be scheduled for Twitter/LinkedIn.
- **Response**: If a response is sent, it will be sent to a router which can be routed to either
  1. A node which will be used to rewrite the post. Please note, the response will be used as the 'user' message in an LLM call to rewrite the post, so ensure your response is properly formatted.
  2. A node which will be used to update the scheduled date for the post.
  If an unknown/invalid response is sent, nothing will happen, and it will be routed back to the human node.
- **Accept**: If 'accept' is selected, the post will be scheduled for Twitter/LinkedIn.
- **Ignore**: If 'ignore' is selected, this post will not be scheduled, and the thread will end.

## Additional Instructions

### Schedule Date

The date the post will be scheduled for may be edited, but it must follow the format 'MM/dd/yyyy hh:mm a z'. Example: '12/25/2024 10:00 AM PST', _OR_ you can use a priority level:
- **P1**: Saturday/Sunday between 8:00 AM and 10:00 AM PST.
- **P2**: Friday/Monday between 8:00 AM and 10:00 AM PST _OR_ Saturday/Sunday between 11:30 AM and 1:00 PM PST.
- **P3**: Saturday/Sunday between 1:00 PM and 5:00 PM PST.

### Image

${imageInstructionsString}
`;
}

const getUnknownResponseDescription = (state: GenerateThreadState) => {
  if (state.next === "unknownResponse" && state.userResponse) {
    return `# <div style="color: red;">UNKNOWN/INVALID RESPONSE RECEIVED: '${state.userResponse}'</div>

<div style="color: red;">Please respond with either a request to update/rewrite the post, or a valid priority level or a date to schedule the post.</div>

<div style="color: red;">See the \`Schedule Date\`, or \`Instructions\` sections for more information.</div>

<hr />`;
  }
  return "";
};

function extractThreadPostsFromArgs(
  args: Record<string, string>,
): ThreadPost[] {
  const posts: ThreadPost[] = [];

  // Find all keys that match post_X pattern
  Object.entries(args).forEach(([key, value]) => {
    const match = key.match(/^post_(\d+)$/);
    if (match) {
      const index = parseInt(match[1], 10);
      posts.push({
        text: value,
        index,
      });
    }
  });

  // Sort posts by index to maintain order
  return posts.sort((a, b) => a.index - b.index);
}

export async function humanNode(
  state: GenerateThreadState,
  _config: LangGraphRunnableConfig,
): Promise<Partial<GenerateThreadState>> {
  if (!state.threadPosts.length) {
    throw new Error("No thread found");
  }

  const unknownResponseDescription = getUnknownResponseDescription(state);
  const defaultDate = state.scheduleDate || getNextSaturdayDate();
  let defaultDateString = "";
  if (
    typeof state.scheduleDate === "string" &&
    ["p1", "p2", "p3"].includes(state.scheduleDate)
  ) {
    defaultDateString = state.scheduleDate as string;
  } else {
    defaultDateString = formatInTimeZone(
      defaultDate,
      "America/Los_Angeles",
      "MM/dd/yyyy hh:mm a z",
    );
  }

  const interruptValue: HumanInterrupt = {
    action_request: {
      action: "Schedule Twitter/LinkedIn thread",
      args: {
        ...Object.fromEntries(
          state.threadPosts.map((p) => [`post_${p.index}`, p.text]),
        ),
        date: defaultDateString,
        // Do not provide an image field if the mode is text only
        image: state.image?.imageUrl ?? "",
      },
    },
    config: {
      allow_accept: true,
      allow_edit: true,
      allow_ignore: true,
      allow_respond: true,
    },
    description: constructDescription({
      threadPosts: state.threadPosts,
      unknownResponseDescription,
    }),
  };

  const response = interrupt<HumanInterrupt[], HumanResponse[]>([
    interruptValue,
  ])[0];

  if (!["edit", "ignore", "accept", "response"].includes(response.type)) {
    throw new Error(
      `Unexpected response type: ${response.type}. Must be "edit", "ignore", "accept", or "response".`,
    );
  }
  if (response.type === "ignore") {
    return {
      next: END,
    };
  }
  if (!response.args) {
    throw new Error(
      `Unexpected response args: ${response.args}. Must be defined.`,
    );
  }

  if (response.type === "response") {
    if (typeof response.args !== "string") {
      throw new Error("Response args must be a string.");
    }

    const { route } = await routeResponse({
      post: state.threadPosts.map((p) => p.text).join("\n"),
      dateOrPriority: defaultDateString,
      userResponse: response.args,
    });

    if (route === "rewrite_post") {
      return {
        userResponse: response.args,
        next: "rewritePost",
      };
    }
    if (route === "update_date") {
      return {
        userResponse: response.args,
        next: "updateScheduleDate",
      };
    }

    return {
      userResponse: response.args,
      next: "unknownResponse",
    };
  }

  if (typeof response.args !== "object") {
    throw new Error(
      `Unexpected response args type: ${typeof response.args}. Must be an object.`,
    );
  }
  if (!("args" in response.args)) {
    throw new Error(
      `Unexpected response args value: ${response.args}. Must be defined.`,
    );
  }

  const castArgs = response.args.args as unknown as Record<string, string>;
  const threadPosts = extractThreadPostsFromArgs(castArgs);
  if (!threadPosts.length) {
    throw new Error("No thread posts found");
  }

  const postDateString = castArgs.date || defaultDateString;
  const postDate = parseDateResponse(postDateString);
  if (!postDate) {
    // TODO: Handle invalid dates better
    throw new Error(
      `Invalid date provided. Expected format: 'MM/dd/yyyy hh:mm a z' or 'P1'/'P2'/'P3'. Received: '${postDateString}'`,
    );
  }

  let imageState: { imageUrl: string; mimeType: string } | undefined =
    undefined;
  const processedImage = await processImageInput(castArgs.image);
  if (processedImage && processedImage !== "remove") {
    imageState = processedImage;
  } else if (processedImage === "remove") {
    imageState = undefined;
  } else {
    imageState = state.image;
  }

  return {
    next: "schedulePost",
    scheduleDate: postDate,
    threadPosts,
    // TODO: Update so if the mime type is blacklisted, it re-routes to human node with an error message.
    image: imageState,
    userResponse: undefined,
  };
}
