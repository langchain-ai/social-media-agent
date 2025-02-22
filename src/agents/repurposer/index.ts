import { END, START, StateGraph } from "@langchain/langgraph";
import {
  RepurposerGraphAnnotation,
  RepurposerInputAnnotation,
  RepurposerState,
} from "./types.js";
import { extractContent } from "./nodes/extract-content/index.js";
import { generateCampaignPlan } from "./nodes/generate-campaign-plan.js";
import { generatePosts } from "./nodes/generate-posts.js";
import { humanNode } from "./nodes/human-node/index.js";
import { rewritePosts } from "./nodes/rewrite-posts.js";
import { schedulePosts } from "./nodes/schedule-posts.js";
import { generateReportGraph } from "../generate-report/index.js";
import { validateImages } from "./nodes/validate-images.js";

function routeFromHumanNode(
  state: RepurposerState,
): "rewritePosts" | "schedulePosts" | "humanNode" | typeof END {
  if (state.next === "rewritePosts" && state.userResponse) {
    return "rewritePosts";
  }

  if (state.next === "unknownResponse") {
    // TODO: Implement unknown response
    return "humanNode";
  }

  return state.next;
}

const repurposerBuilder = new StateGraph({
  stateSchema: RepurposerGraphAnnotation,
  input: RepurposerInputAnnotation,
})
  .addNode("extractContent", extractContent)
  .addNode("validateImages", validateImages)
  .addNode("generateReport", generateReportGraph)
  .addNode("generateCampaignPlan", generateCampaignPlan)
  .addNode("generatePosts", generatePosts)
  .addNode("humanNode", humanNode)
  .addNode("rewritePosts", rewritePosts)
  .addNode("schedulePosts", schedulePosts)

  .addEdge(START, "extractContent")
  .addEdge("extractContent", "validateImages")
  .addEdge("validateImages", "generateReport")
  .addEdge("generateReport", "generateCampaignPlan")
  .addEdge("generateCampaignPlan", "generatePosts")
  .addEdge("generatePosts", "humanNode")
  .addConditionalEdges("humanNode", routeFromHumanNode, [
    "rewritePosts",
    "rewritePosts",
    "schedulePosts",
    "humanNode",
    END,
  ])
  .addEdge("rewritePosts", "humanNode")
  .addEdge("schedulePosts", END);

export const repurposerGraph = repurposerBuilder.compile();

repurposerGraph.name = "Repurposer Graph";
