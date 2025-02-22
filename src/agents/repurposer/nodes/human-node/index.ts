import { RepurposerState } from "../../types.js";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";
import { END, interrupt } from "@langchain/langgraph";
import { parseDateResponse, PRIORITY_LEVELS } from "../../../../utils/date.js";
import {
  constructDescription,
  extractPostsFromArgs,
  getUnknownResponseDescription,
  processImageArgs,
} from "./utils.js";
import { routeResponse } from "./router.js";
import { formatInTimeZone } from "date-fns-tz";
import { capitalize } from "../../../utils.js";

export async function humanNode(
  state: RepurposerState,
): Promise<Partial<RepurposerState>> {
  if (!state.posts.length) {
    throw new Error("No posts found");
  }

  let defaultDateString = "r1";
  if (
    typeof state.scheduleDate === "string" &&
    PRIORITY_LEVELS.includes(state.scheduleDate)
  ) {
    defaultDateString = state.scheduleDate as string;
  } else if (state.scheduleDate && typeof state.scheduleDate === "object") {
    console.log("ATTEMPTING TO FORMAT DATE", state.scheduleDate);
    defaultDateString = formatInTimeZone(
      state.scheduleDate,
      "America/Los_Angeles",
      "MM/dd/yyyy hh:mm a z",
    );
  }

  const postOrPosts = state.posts.length === 1 ? "post" : "posts";

  const interruptValue: HumanInterrupt = {
    action_request: {
      action: `Schedule Repurposed ${capitalize(postOrPosts)}`,
      args: {
        date: defaultDateString,
        ...Object.fromEntries(
          state.posts.flatMap((p) => [
            [`post_${p.index}`, p.content],
            [
              `image_${p.index}`,
              state.images.find((i) => i.index === p.index)?.imageUrl ?? "",
            ],
          ]),
        ),
      },
    },
    config: {
      allow_accept: true,
      allow_edit: true,
      allow_ignore: true,
      allow_respond: true,
    },
    description: constructDescription({
      state,
      unknownResponseDescription: getUnknownResponseDescription(state),
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

    const { route } = await routeResponse(state.posts, response.args);

    if (route === "rewrite_posts") {
      return {
        userResponse: response.args,
        next: "rewritePosts",
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
  const posts = extractPostsFromArgs(castArgs);
  if (!posts.length) {
    throw new Error("No posts found");
  }

  const images = await processImageArgs(castArgs);

  const postDateString = castArgs.date || defaultDateString;
  const postDate = parseDateResponse(postDateString);
  if (!postDate) {
    // TODO: Handle invalid dates better
    throw new Error(
      `Invalid date provided. Expected format: 'MM/dd/yyyy hh:mm a z' or 'P1'/'P2'/'P3'/'R1'/'R2'/'R3'. Received: '${postDateString}'`,
    );
  }

  return {
    next: "schedulePosts",
    scheduleDate: postDate,
    posts,
    images,
    userResponse: undefined,
  };
}
