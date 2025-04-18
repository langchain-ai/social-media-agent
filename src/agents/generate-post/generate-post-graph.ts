import {
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import {
  GeneratePostAnnotation,
  GeneratePostConfigurableAnnotation,
  GeneratePostInputAnnotation,
  GeneratePostState,
  GeneratePostUpdate,
} from "./generate-post-state.js";
import { generateContentReport } from "./nodes/generate-report/index.js";
import { generatePost } from "./nodes/generate-post/index.js";
import { condensePost } from "./nodes/condense-post.js";
import { isTextOnly, removeUrls, shouldPostToLinkedInOrg } from "../utils.js";
import { verifyLinksGraph } from "../verify-links/verify-links-graph.js";
import { authSocialsPassthrough } from "./nodes/auth-socials.js";
import { findImagesGraph } from "../find-images/find-images-graph.js";
import { updateScheduledDate } from "../shared/nodes/update-scheduled-date.js";
import { getSavedUrls } from "../shared/stores/post-subject-urls.js";
import { humanNode } from "../shared/nodes/generate-post/human-node.js";
import { schedulePost } from "../shared/nodes/generate-post/schedule-post.js";
import { rewritePost } from "../shared/nodes/generate-post/rewrite-post.js";
import { Client } from "@langchain/langgraph-sdk";
import { POST_TO_LINKEDIN_ORGANIZATION } from "./constants.js";
import { rewritePostWithSplitUrl } from "./nodes/rewrite-with-split-url.js";

function routeAfterGeneratingReport(
  state: GeneratePostState,
): "generatePost" | typeof END {
  if (state.report) {
    return "generatePost";
  }
  return END;
}

function rewriteOrEndConditionalEdge(
  state: GeneratePostState,
):
  | "rewritePost"
  | "schedulePost"
  | "updateScheduleDate"
  | "humanNode"
  | "rewriteWithSplitUrl"
  | typeof END {
  if (state.next) {
    if (state.next === "unknownResponse") {
      // If the user's response is unknown, we should route back to the human node.
      return "humanNode";
    }
    return state.next;
  }
  return END;
}

async function condenseOrHumanConditionalEdge(
  state: GeneratePostState,
  config: LangGraphRunnableConfig,
): Promise<"condensePost" | "humanNode" | "findImagesSubGraph" | typeof END> {
  const cleanedPost = removeUrls(state.post || "");
  if (cleanedPost.length > 280 && state.condenseCount <= 3) {
    return "condensePost";
  }

  const isTextOnlyMode = isTextOnly(config);
  if (isTextOnlyMode) {
    return routeToCuratedInterruptOrContinue(state, config);
  }
  return "findImagesSubGraph";
}

/**
 * Checks if any of the URLs in the array are already stored in the post subject URLs store.
 * If so, it returns `true` and the post should NOT be generated.
 * @param urls The array of URLs to check. These are all of the input & extracted relevant URLs.
 * @param config The LangGraph config to get the store from.
 * @returns {Promise<boolean>} `true` if any of the URLs in the array are already stored in the post subject URLs store. `false` otherwise.
 */
async function checkIfUrlsArePreviouslyUsed(
  urls: string[],
  config: LangGraphRunnableConfig,
) {
  const existingUrls = await getSavedUrls(config);
  return urls.some((url) =>
    existingUrls.some((existingUrl) => url === existingUrl),
  );
}

async function generateReportOrEndConditionalEdge(
  state: GeneratePostState,
  config: LangGraphRunnableConfig,
): Promise<"generateContentReport" | typeof END> {
  const urlsAlreadyUsed = await checkIfUrlsArePreviouslyUsed(
    [...(state.relevantLinks ?? []), ...state.links],
    config,
  );

  // End early if the URLs have already been used, or if there are no
  // page contents extracted from any of the URLs.
  if (urlsAlreadyUsed || !state.pageContents?.length) {
    return END;
  }

  return "generateContentReport";
}

/**
 * If the 'origin' is set to 'curate-data' we need to route to a new graph 'curated_data_interrupt'
 * for the interrupt, so that users can separate curated posts from posts ingested from Slack in the
 * Agent Inbox.
 */
async function routeToCuratedInterruptOrContinue(
  state: GeneratePostState,
  config: LangGraphRunnableConfig,
): Promise<"humanNode" | typeof END> {
  if (config.configurable?.origin === "curate-data") {
    const postToLinkedInOrg = shouldPostToLinkedInOrg(config);
    const client = new Client({
      apiUrl: `http://localhost:${process.env.PORT}`,
    });

    const { thread_id } = await client.threads.create();
    await client.runs.create(thread_id, "curated_post_interrupt", {
      input: state,
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
        },
      },
    });

    return END;
  }

  return "humanNode";
}

const generatePostBuilder = new StateGraph(
  { stateSchema: GeneratePostAnnotation, input: GeneratePostInputAnnotation },
  GeneratePostConfigurableAnnotation,
)
  .addNode("authSocialsPassthrough", authSocialsPassthrough)

  .addNode("verifyLinksSubGraph", verifyLinksGraph)

  // Generates a Tweet/LinkedIn post based on the report content.
  .addNode("generatePost", generatePost)
  // Attempt to condense the post if it's too long.
  .addNode("condensePost", condensePost)
  // Interrupts the node for human in the loop.
  .addNode("humanNode", humanNode<GeneratePostState, GeneratePostUpdate>)
  // Schedules the post for Twitter/LinkedIn.
  .addNode("schedulePost", schedulePost<GeneratePostState, GeneratePostUpdate>)
  // Rewrite a post based on the user's response.
  .addNode("rewritePost", rewritePost<GeneratePostState, GeneratePostUpdate>)
  // Generates a report on the content.
  .addNode("generateContentReport", generateContentReport)
  // Finds images in the content.
  .addNode("findImagesSubGraph", findImagesGraph)
  // Updated the scheduled date from the natural language response from the user.
  .addNode("updateScheduleDate", updateScheduledDate)
  // Rewrite the post splitting the URL from the main body of the tweet
  .addNode("rewriteWithSplitUrl", rewritePostWithSplitUrl)

  // Start node
  .addEdge(START, "authSocialsPassthrough")
  .addEdge("authSocialsPassthrough", "verifyLinksSubGraph")

  // After verifying the different content types, we should generate a report on them.
  .addConditionalEdges(
    "verifyLinksSubGraph",
    generateReportOrEndConditionalEdge,
    ["generateContentReport", END],
  )

  // Once generating a report, we should confirm the report exists (meaning the content is relevant).
  .addConditionalEdges("generateContentReport", routeAfterGeneratingReport, [
    "generatePost",
    END,
  ])

  // After generating the post for the first time, check if it's too long,
  // and if so, condense it. Otherwise, route to the human node.
  .addConditionalEdges("generatePost", condenseOrHumanConditionalEdge, [
    "condensePost",
    "findImagesSubGraph",
    "humanNode",
    END,
  ])
  // After condensing the post, we should verify again that the content is below the character limit.
  // Once the post is below the character limit, we can find & filter images. This needs to happen after the post
  // has been generated because the image validator requires the post content.
  .addConditionalEdges("condensePost", condenseOrHumanConditionalEdge, [
    "condensePost",
    "findImagesSubGraph",
    "humanNode",
    END,
  ])

  // After finding images, we are done and can interrupt for the human to respond.
  .addConditionalEdges(
    "findImagesSubGraph",
    routeToCuratedInterruptOrContinue,
    ["humanNode", END],
  )

  // Always route back to `humanNode` if the post was re-written or date was updated.
  .addEdge("rewritePost", "humanNode")
  .addEdge("updateScheduleDate", "humanNode")
  .addEdge("rewriteWithSplitUrl", "humanNode")

  // If the schedule post is successful, end the graph.
  .addConditionalEdges("humanNode", rewriteOrEndConditionalEdge, [
    "rewritePost",
    "schedulePost",
    "updateScheduleDate",
    "humanNode",
    "rewriteWithSplitUrl",
    END,
  ])
  // Always end after scheduling the post.
  .addEdge("schedulePost", END);

export const generatePostGraph = generatePostBuilder.compile();

generatePostGraph.name = "Generate Post Subgraph";
