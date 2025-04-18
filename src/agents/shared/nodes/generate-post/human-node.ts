import { END, LangGraphRunnableConfig, interrupt } from "@langchain/langgraph";
import { BaseGeneratePostState, BaseGeneratePostUpdate } from "./types.js";
import { formatInTimeZone } from "date-fns-tz";
import { isTextOnly, processImageInput } from "../../../utils.js";
import {
  getNextSaturdayDate,
  parseDateResponse,
} from "../../../../utils/date.js";
import { routeResponse } from "../../../shared/nodes/route-response.js";
import { saveUsedUrls } from "../../../shared/stores/post-subject-urls.js";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";
import { DateType } from "../../../types.js";

interface ConstructDescriptionArgs {
  unknownResponseDescription: string;
  report: string;
  originalLink: string;
  relevantLinks: string[];
  post: string;
  imageOptions?: string[];
  isTextOnlyMode: boolean;
}

function constructDescription({
  unknownResponseDescription,
  report,
  originalLink,
  relevantLinks,
  post,
  imageOptions,
  isTextOnlyMode,
}: ConstructDescriptionArgs): string {
  const linksText = `### Relevant URLs:\nOriginal URL: ${originalLink}\n\n- ${relevantLinks.join("\n- ")}\n`;
  const imageOptionsText =
    imageOptions?.length && !isTextOnlyMode
      ? `## Image Options\n\nThe following image options are available. Select one by copying and pasting the URL into the 'image' field.\n\n${imageOptions.map((url) => `URL: ${url}\nImage: <details><summary>Click to view image</summary>\n\n![](${url})\n</details>\n`).join("\n")}`
      : "";

  const unknownResponseString = unknownResponseDescription
    ? `${unknownResponseDescription}\n\n`
    : "";

  const imageInstructionsString =
    imageOptions?.length && !isTextOnlyMode
      ? `If you wish to attach an image to the post, please add a public image URL.

You may remove the image by setting the 'image' field to 'remove', or by removing all text from the field
To replace the image, simply add a new public image URL to the field.

MIME types will be automatically extracted from the image.
Supported image types: \`image/jpeg\` | \`image/gif\` | \`image/png\` | \`image/webp\``
      : isTextOnlyMode
        ? "Text only mode enabled. Image support has been disabled.\n"
        : "No image options available.";

  return `${unknownResponseString}# Schedule post
  
Using these URL(s), a post was generated for Twitter/LinkedIn:
${linksText}

### Post:
\`\`\`
${post}
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

## Report

Here is the report that was generated for the posts:\n${report}
`;
}

const getUnknownResponseDescription = (state: BaseGeneratePostState) => {
  if (state.next === "unknownResponse" && state.userResponse) {
    return `# <div style="color: red;">UNKNOWN/INVALID RESPONSE RECEIVED: '${state.userResponse}'</div>

<div style="color: red;">Please respond with either a request to update/rewrite the post, or a valid priority level or a date to schedule the post.</div>

<div style="color: red;">See the \`Schedule Date\`, or \`Instructions\` sections for more information.</div>

<hr />`;
  }
  return "";
};

export async function humanNode<
  State extends BaseGeneratePostState = BaseGeneratePostState,
  Update extends BaseGeneratePostUpdate = BaseGeneratePostUpdate,
>(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  if (!state.post) {
    throw new Error("No post found");
  }
  const isTextOnlyMode = isTextOnly(config);

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

  const postArgs = state.complexPost
    ? {
        main_post: state.complexPost.main_post,
        reply_post: state.complexPost.reply_post,
      }
    : {
        post: state.post,
      };

  const interruptValue: HumanInterrupt = {
    action_request: {
      action: "Schedule Twitter/LinkedIn post",
      args: {
        ...postArgs,
        date: defaultDateString,
        // Do not provide an image field if the mode is text only
        ...(!isTextOnlyMode && { image: state.image?.imageUrl ?? "" }),
      },
    },
    config: {
      allow_accept: true,
      allow_edit: true,
      allow_ignore: true,
      allow_respond: true,
    },
    description: constructDescription({
      report: state.report,
      originalLink: state.links[0],
      relevantLinks: state.relevantLinks || [],
      post: state.post,
      imageOptions: state.imageOptions,
      unknownResponseDescription,
      isTextOnlyMode,
    }),
  };

  // Save ALL links used to generate this post so that they are not used to generate future posts (duplicates).
  await saveUsedUrls([...(state.relevantLinks ?? []), ...state.links], config);

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
    } as Update;
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
      post: state.post,
      dateOrPriority: defaultDateString,
      userResponse: response.args,
    });

    if (route === "rewrite_post") {
      return {
        userResponse: response.args,
        next: "rewritePost",
      } as Update;
    } else if (route === "update_date") {
      return {
        userResponse: response.args,
        next: "updateScheduleDate",
      } as Update;
    } else if (route === "rewrite_with_split_url") {
      return {
        userResponse: undefined,
        next: "rewriteWithSplitUrl",
      } as Update;
    }

    return {
      userResponse: response.args,
      next: "unknownResponse",
    } as Update;
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

  const post = castArgs.post;
  const complexPost =
    castArgs.main_post && castArgs.reply_post
      ? {
          main_post: castArgs.main_post,
          reply_post: castArgs.reply_post,
        }
      : undefined;
  if (!post && !complexPost) {
    throw new Error(
      `Unexpected response args value: ${post}. Must be defined.\n\nResponse args:\n${JSON.stringify(response.args, null, 2)}`,
    );
  }

  const postDateString = castArgs.date;
  let postDate: DateType | undefined;
  if (postDateString) {
    postDate = parseDateResponse(postDateString);
    if (!postDate) {
      throw new Error(
        "Invalid date provided.\n\n" +
          "Expected format: 'MM/dd/yyyy hh:mm a z' or 'P1'/'P2'/'P3' or leave empty to post now.\n\n" +
          `Received: '${postDateString}'`,
      );
    }
  }

  let imageState: { imageUrl: string; mimeType: string } | undefined =
    undefined;
  if (!isTextOnlyMode) {
    const processedImage = await processImageInput(castArgs.image);
    if (processedImage && processedImage !== "remove") {
      imageState = processedImage;
    } else if (processedImage === "remove") {
      imageState = undefined;
    } else {
      imageState = state.image;
    }
  }

  return {
    next: "schedulePost",
    scheduleDate: postDate,
    ...(post ? { post } : {}),
    ...(complexPost ? { complexPost } : {}),
    // TODO: Update so if the mime type is blacklisted, it re-routes to human node with an error message.
    image: imageState,
    userResponse: undefined,
  } as Update;
}
