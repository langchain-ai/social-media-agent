import { END, Send, START, StateGraph } from "@langchain/langgraph";
import { VerifyContentAnnotation } from "../shared/shared-state.js";
import { verifyYouTubeContent } from "../shared/nodes/verify-youtube.js";
import { verifyGeneralContent } from "../shared/nodes/verify-general.js";
import { verifyGitHubContent } from "../shared/nodes/verify-github.js";
import { verifyTweetGraph } from "../verify-tweet/verify-tweet-graph.js";
import { VerifyLinksGraphAnnotation } from "./verify-links-state.js";
import { getUrlType } from "../utils.js";
import { verifyRedditPostGraph } from "../verify-reddit-post/verify-reddit-post-graph.js";
import { VerifyRedditPostAnnotation } from "../verify-reddit-post/verify-reddit-post-state.js";
import { verifyLumaEvent } from "../shared/nodes/verify-luma.js";

function routeLinkTypes(state: typeof VerifyLinksGraphAnnotation.State) {
  return state.links.map((link) => {
    const type = getUrlType(link);
    if (type === "twitter") {
      return new Send("verifyTweetSubGraph", {
        link,
      });
    }
    if (type === "youtube") {
      return new Send("verifyYouTubeContent", {
        link,
      });
    }
    if (type === "github") {
      return new Send("verifyGitHubContent", {
        link,
      });
    }
    if (type === "reddit") {
      return new Send("verifyRedditContent", {
        link,
      });
    }
    if (type === "luma") {
      return new Send("verifyLumaEvent", {
        link,
      });
    }
    return new Send("verifyGeneralContent", {
      link,
    });
  });
}

const verifyLinksWorkflow = new StateGraph(VerifyLinksGraphAnnotation)
  .addNode("verifyYouTubeContent", verifyYouTubeContent, {
    input: VerifyContentAnnotation,
  })
  .addNode("verifyGeneralContent", verifyGeneralContent, {
    input: VerifyContentAnnotation,
  })
  .addNode("verifyGitHubContent", verifyGitHubContent, {
    input: VerifyContentAnnotation,
  })
  .addNode("verifyTweetSubGraph", verifyTweetGraph, {
    input: VerifyContentAnnotation,
  })
  .addNode("verifyRedditContent", verifyRedditPostGraph, {
    input: VerifyRedditPostAnnotation,
  })
  .addNode("verifyLumaEvent", verifyLumaEvent, {
    input: VerifyContentAnnotation,
  })
  // Start node
  .addConditionalEdges(START, routeLinkTypes, [
    "verifyYouTubeContent",
    "verifyGeneralContent",
    "verifyGitHubContent",
    "verifyTweetSubGraph",
    "verifyRedditContent",
    "verifyLumaEvent",
  ])
  .addEdge("verifyRedditContent", END)
  .addEdge("verifyYouTubeContent", END)
  .addEdge("verifyGeneralContent", END)
  .addEdge("verifyGitHubContent", END)
  .addEdge("verifyTweetSubGraph", END)
  .addEdge("verifyLumaEvent", END);

export const verifyLinksGraph = verifyLinksWorkflow.compile();
verifyLinksGraph.name = "Verify Links Subgraph";
