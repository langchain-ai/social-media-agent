import { v4 as uuidv4 } from "uuid";
import * as ls from "langsmith/jest";
import { type SimpleEvaluator } from "langsmith/jest";
import { INPUTS } from "./inputs.js";
import { generatePostGraph } from "../../agents/generate-post/generate-post-graph.js";
import { InMemoryStore, MemorySaver } from "@langchain/langgraph";
import { HumanInterrupt } from "@langchain/langgraph/prebuilt";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../../agents/generate-post/constants.js";
import { removeUrls } from "../../agents/utils.js";
import { GeneratePostAnnotation } from "../../agents/generate-post/generate-post-state.js";

const checkGeneratePostResult: SimpleEvaluator = ({ expected, actual }) => {
  // Check the following:
  // 1(a). A post was generated
  // 1(b). Check post length is less than or equal to 280 after removing URL.
  // 2. Check page contents were extracted
  // 3. A report was generated with the proper fields (check markdown headers)
  // 4. Check images were generated
  // 5. Check the interrupt value is as expected

  // If any are false, return 0
  // If all are true, return 1.
  let postScore = 0;
  let pageContentsScore = 0;
  let reportScore = 0;
  let imagesScore = 0;
  let interruptScore = 0;

  const { state, interrupt } = actual as {
    state: typeof GeneratePostAnnotation.State;
    interrupt: HumanInterrupt | undefined;
  };

  if (
    !state.pageContents?.length &&
    !state.relevantLinks?.length &&
    !state.imageOptions?.length
  ) {
    // Likely did not pass the validation step. Fail.
    return {
      key: "correct_post_generation",
      score: 0,
      evaluatorInfo: {
        postScore: 0,
        pageContentsScore: 0,
        reportScore: 0,
        imagesScore: 0,
        interruptScore: 0,
      },
    };
  }

  if (state.post) {
    const cleanedPost = removeUrls(state.post || "");
    if (cleanedPost.length <= 280 && cleanedPost.length > 0) {
      postScore = 1;
    }
  }

  if (state.pageContents?.length) {
    pageContentsScore = 1;
  }

  if (state.report.length > 0) {
    // TODO: Extract headers and validate they are correct
    reportScore = 1;
  }

  if (state.imageOptions?.length) {
    if (state.imageOptions.length === expected.imageOptions.length) {
      imagesScore = 1;
    }
  }

  if (interrupt) {
    interruptScore = 1;
  }

  const totalScore =
    postScore + pageContentsScore + reportScore + imagesScore + interruptScore;
  let score = 0;
  if (totalScore === 5) {
    score = 1;
  }

  return {
    key: "correct_post_generation",
    score,
    evaluatorInfo: {
      postScore,
      pageContentsScore,
      reportScore,
      imagesScore,
      interruptScore,
    },
  };
};

const BASE_CONFIG = {
  [POST_TO_LINKEDIN_ORGANIZATION]: undefined,
  [TEXT_ONLY_MODE]: false,
};

ls.describe("SMA - E2E", () => {
  ls.test.each(INPUTS)(
    "Should validate the end to end flow of the generate post agent",
    async ({ inputs }) => {
      const graph = generatePostGraph;
      graph.checkpointer = new MemorySaver();
      graph.store = new InMemoryStore();

      const threadId = uuidv4();
      const config = {
        configurable: {
          thread_id: threadId,
          ...BASE_CONFIG,
        },
      };

      await generatePostGraph.invoke(inputs, config);
      const graphState = await generatePostGraph.getState(config);
      const state = graphState.values;
      const interruptValue = graphState.tasks[0]?.interrupts?.[0]?.value;
      // console.log("\nState\n", state);
      // console.log("\nInterrupt Value\n", interruptValue);
      console.log("Finished invoking graph with URL", inputs.links[0]);
      await ls
        .expect({
          state,
          interrupt: interruptValue,
        })
        .evaluatedBy(checkGeneratePostResult)
        .toBe(1);
      return graphState;
    },
  );
});
