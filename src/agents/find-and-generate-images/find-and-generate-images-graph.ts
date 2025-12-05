import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { findImages } from "./nodes/find-images.js";
import { validateImages } from "./nodes/validate-images.js";
import { reRankImages } from "./nodes/re-rank-images.js";
import { generateImageCandidatesForPost } from "./nodes/generate-images.js";
import { VerifyLinksResultAnnotation } from "../verify-links/verify-links-state.js";
import { Image } from "../types.js";

export const FindAndGenerateImagesAnnotation = Annotation.Root({
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
   * The image candidates for the post.
   */
  image_candidates: Annotation<Image[]>,
});

function validateImagesOrGenerateDirectly(
  state: typeof FindAndGenerateImagesAnnotation.State,
) {
  if (state.imageOptions?.length) {
    return "validateImages";
  }
  return "generateImageCandidates";
}

const findAndGenerateImagesWorkflow = new StateGraph(FindAndGenerateImagesAnnotation)
  .addNode("findImages", findImages)
  .addNode("validateImages", validateImages)
  .addNode("reRankImages", reRankImages)
  .addNode("generateImageCandidates", generateImageCandidatesForPost)

  .addEdge(START, "findImages")

  .addConditionalEdges("findImages", validateImagesOrGenerateDirectly, [
    "validateImages",
    "generateImageCandidates",
  ])

  .addEdge("validateImages", "reRankImages")

  .addEdge("reRankImages", "generateImageCandidates")

  .addEdge("generateImageCandidates", END);

export const findAndGenerateImagesGraph = findAndGenerateImagesWorkflow.compile();
findAndGenerateImagesGraph.name = "Find And Generate Images Graph";
