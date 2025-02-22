import * as ls from "langsmith/jest";
import { SimpleEvaluator } from "langsmith/jest";
import { repurposerGraph } from "../index.js";

const tweetEvaluator: SimpleEvaluator = () => {
  return {
    key: "content_extraction",
    score: 1,
  };
};

ls.describe("SMA - Repurposer", () => {
  ls.test(
    "Can extract content",
    {
      inputs: {
        originalLink: "https://x.com/LangChainAI/status/1857117443065540707",
        quality: 3,
      },
      expected: {},
    },
    async ({ inputs }) => {
      const result = await repurposerGraph.nodes.extractContent.invoke(
        inputs as any,
      );

      console.log("Result\n");
      console.dir(result, { depth: null });

      await ls.expect(result).evaluatedBy(tweetEvaluator).toBe(1);
      return result;
    },
  );
});
