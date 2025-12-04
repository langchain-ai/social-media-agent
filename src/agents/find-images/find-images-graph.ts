import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { findImages } from "./nodes/find-images.js";
import { validateImages } from "./nodes/validate-images.js";
import { reRankImages } from "./nodes/re-rank-images.js";
import { generateImageCandidatesForPost } from "./nodes/generate-image.js";
import { VerifyLinksResultAnnotation } from "../verify-links/verify-links-state.js";
import { Image } from "../types.js";

export const FindImagesAnnotation = Annotation.Root({
  ...VerifyLinksResultAnnotation.spec,
  /**
   * The report generated on the content of the message. Used
   * as context for generating the post.
   */
  report: Annotation<string>,
  /**
   * The generated post for LinkedIn/Twitter.
   */
  post: Annotation<string>,
  /**
   * The generated image candidates.
   */
  generated_image_candidates: Annotation<Image[]>,
});

function validateImagesOrEnd(state: typeof FindImagesAnnotation.State) {
  if (state.imageOptions?.length) {
    return "validateImages";
  }
  return END;
}

const findImagesWorkflow = new StateGraph(FindImagesAnnotation)
  .addNode("findImages", findImages)
  .addNode("validateImages", validateImages)
  .addNode("reRankImages", reRankImages)
  .addNode("generateImageCandidates", generateImageCandidatesForPost)

  .addEdge(START, "findImages")

  .addConditionalEdges("findImages", validateImagesOrEnd, [
    "validateImages",
    END,
  ])

  .addEdge("validateImages", "reRankImages")

  .addEdge("reRankImages", "generateImageCandidates")

  .addEdge("generateImageCandidates", END);

export const findImagesGraph = findImagesWorkflow.compile();
findImagesGraph.name = "Find Images Graph";
