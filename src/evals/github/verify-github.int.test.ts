import { v4 as uuidv4 } from "uuid";
import * as ls from "langsmith/jest";
import { type SimpleEvaluator } from "langsmith/jest";
import { verifyGitHubContent } from "../../agents/shared/nodes/verify-github.js";
import { SKIP_CONTENT_RELEVANCY_CHECK } from "../../agents/generate-post/constants.js";

const INPUTS = [
  {
    inputs: {
      // TBD: Yes or no?
      link: "https://github.com/FlowiseAI/Flowise",
    },
    expected: {
      relevant: false,
    },
  },
  {
    inputs: {
      link: "https://github.com/realpython/materials",
    },
    expected: {
      relevant: false,
    },
  },
  {
    inputs: {
      link: "https://github.com/NirDiamant/GenAI_Agents",
    },
    expected: {
      relevant: false,
    },
  },
  {
    inputs: {
      link: "https://github.com/Weasley18/DocVer",
    },
    expected: {
      relevant: false,
    },
  },
  {
    inputs: {
      link: "https://github.com/plurai-ai/intellagent",
    },
    expected: {
      relevant: false,
    },
  },
  {
    inputs: {
      link: "https://github.com/ShayanTalaei/CHESS",
    },
    expected: {
      relevant: true,
    },
  },
  {
    inputs: {
      link: "https://github.com/datawhalechina/llm-universe",
    },
    expected: {
      relevant: true,
    },
  },
  {
    inputs: {
      link: "https://github.com/NirDiamant/RAG_Techniques",
    },
    expected: {
      relevant: false,
    },
  },
  {
    inputs: {
      link: "https://github.com/gaudiy/langsmith-evaluation-helper",
    },
    expected: {
      relevant: true,
    },
  },
  {
    inputs: {
      link: "https://github.com/starpig1129/DATAGEN",
    },
    expected: {
      relevant: true,
    },
  },
  {
    inputs: {
      link: "https://github.com/samwit/agent_tutorials/tree/main/agent_write",
    },
    expected: {
      relevant: true,
    },
  },
  {
    inputs: {
      link: "https://github.com/kaarthik108/snowChat",
    },
    expected: {
      relevant: true,
    },
  },
  {
    inputs: {
      link: "https://github.com/ahmad2b/postbot3000",
    },
    expected: {
      relevant: true,
    },
  },
  {
    inputs: {
      link: "https://github.com/elizabethsiegle/wnba-analytics-dash-ai-insights/tree/main",
    },
    expected: {
      relevant: true,
    },
  },
  {
    inputs: {
      link: "https://github.com/souzatharsis/podcastfy",
    },
    expected: {
      relevant: true,
    },
  },
];

const checkVerifyPostResult: SimpleEvaluator = ({ expected, actual }) => {
  const { pageContents } = actual as { pageContents?: string[] };
  const { relevant } = expected as { relevant: boolean };

  const hasPageContentsAndLinks = pageContents && pageContents?.length > 0;

  if (relevant) {
    return {
      key: "validation_result_expected",
      score: Number(hasPageContentsAndLinks),
    };
  }

  return {
    key: "validation_result_expected",
    score: Number(!hasPageContentsAndLinks),
  };
};

ls.describe("SMA - Verify GitHub Repo", () => {
  ls.test.each(INPUTS)(
    "Evaluates the verify GitHub repo node",
    async ({ inputs }) => {
      const threadId = uuidv4();
      const config = {
        configurable: {
          [SKIP_CONTENT_RELEVANCY_CHECK]: false,
          thread_id: threadId,
        },
      };

      const results = await verifyGitHubContent(inputs, config);
      console.log("Finished invoking graph with URL", inputs.link);
      await ls
        .expect(results)
        .evaluatedBy(checkVerifyPostResult)
        // Expect this to be 1, if it's 0 that means there's a discrepancy between the expected, and whether or not page contents and links were found
        .toBe(1);
      return results;
    },
  );
});
