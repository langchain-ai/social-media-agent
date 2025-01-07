import { END, LangGraphRunnableConfig, interrupt } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { formatInTimeZone } from "date-fns-tz";
import { HumanInterrupt, HumanResponse } from "../../../types.js";
import { processImageInput } from "../../../utils.js";
import {
  getNextSaturdayDate,
  parseDateResponse,
} from "../../../../utils/date.js";
import { routeResponse } from "./route-response.js";

interface ConstructDescriptionArgs {
  report: string;
  originalLink: string;
  relevantLinks: string[];
  post: string;
  imageOptions?: string[];
}

function constructDescription({
  report,
  originalLink,
  relevantLinks,
  post,
  imageOptions,
}: ConstructDescriptionArgs): string {
  const linksText = `### Relevant URLs:\n- ${relevantLinks.join("\n- ")}\nOriginal URL: ${originalLink}`;
  const imageOptionsText = imageOptions?.length
    ? `## Image Options\n\nThe following image options are available. Select one by copying and pasting the URL into the 'image' field.\n\n${imageOptions.map((url) => `URL: ${url}\nImage: <details><summary>Click to view image</summary>\n\n![](${url})\n</details>\n`).join("\n")}`
    : "";

  return `# Schedule post
  
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
- **Accept**: If 'accept' is selected, the post will be scheduled for Twitter/LinkedIn.
- **Ignore**: If 'ignore' is selected, this post will not be scheduled, and the thread will end.

## Additional Instructions

### Schedule Date

The date the post will be scheduled for may be edited, but it must follow the format 'MM/dd/yyyy hh:mm a z'. Example: '12/25/2024 10:00 AM PST', _OR_ you can use a priority level:
- **P1**: Saturday/Sunday between 8:00 AM and 10:00 AM PST.
- **P2**: Friday/Monday between 8:00 AM and 10:00 AM PST _OR_ Saturday/Sunday between 11:30 AM and 1:00 PM PST.
- **P3**: Saturday/Sunday between 1:00 PM and 5:00 PM PST.

### Image

If you wish to attach an image to the post, please add a public image URL.

You may remove the image by setting the 'image' field to 'remove', or by removing all text from the field
To replace the image, simply add a new public image URL to the field.

MIME types will be automatically extracted from the image.
Supported image types: \`image/jpeg\` | \`image/gif\` | \`image/png\` | \`image/webp\`

## Report

Here is the report that was generated for the posts:\n${report}
`;
}

export async function humanNode(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.post) {
    throw new Error("No post found");
  }

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

  const imageURL = state.image?.imageUrl ?? "";
  const interruptValue: HumanInterrupt = {
    action_request: {
      action: "Schedule Twitter/LinkedIn posts",
      args: {
        post: state.post,
        date: defaultDateString,
        image: imageURL,
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
      relevantLinks: state.relevantLinks,
      post: state.post,
      imageOptions: state.imageOptions,
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
      post: state.post,
      dateOrPriority: defaultDateString,
      userResponse: response.args,
      config,
    });

    if (route === "rewrite_post") {
      return {
        userResponse: response.args,
        next: "rewritePost",
      };
    }

    return {
      userResponse: response.args,
      next: "updateScheduleDate",
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

  const responseOrPost = castArgs.post;
  if (!responseOrPost) {
    throw new Error(
      `Unexpected response args value: ${responseOrPost}. Must be defined.\n\nResponse args:\n${JSON.stringify(response.args, null, 2)}`,
    );
  }

  const postDateString = castArgs.date || defaultDateString;
  const postDate = parseDateResponse(postDateString);
  if (!postDate) {
    // TODO: Handle invalid dates better
    throw new Error(
      `Invalid date provided. Expected format: 'MM/dd/yyyy hh:mm a z' or 'P1'/'P2'/'P3'. Received: '${postDateString}'`,
    );
  }

  const processedImage = await processImageInput(castArgs.image);

  let imageState: { imageUrl: string; mimeType: string } | undefined =
    undefined;
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
    image: imageState,
  };
}
