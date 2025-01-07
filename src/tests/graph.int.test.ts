import { describe, it } from "@jest/globals";
import {
  GITHUB_MESSAGE,
  GITHUB_URL_STATE,
  TWITTER_NESTED_GITHUB_MESSAGE,
} from "./states.js";
import { TwitterApi } from "twitter-api-v2";
import { resolveTwitterUrl } from "../agents/verify-tweet/utils.js";
import { EXPECTED_README } from "./expected.js";
import { getPageText } from "../agents/utils.js";
import { generatePostGraph } from "../agents/generate-post/generate-post-graph.js";
import { getYouTubeVideoDuration } from "../agents/shared/nodes/youtube.utils.js";
import { getGitHubContentsAndTypeFromUrl } from "../agents/shared/nodes/verify-github.js";
import { verifyYouTubeContent } from "../agents/shared/nodes/verify-youtube.js";
import { Command, MemorySaver } from "@langchain/langgraph";
import { verifyTweetGraph } from "../agents/verify-tweet/verify-tweet-graph.js";
import {
  LLM_MODEL_NAME,
  POST_TO_LINKEDIN_ORGANIZATION,
} from "../agents/generate-post/constants.js";

const BASE_CONFIG = {
  [POST_TO_LINKEDIN_ORGANIZATION]: undefined,
  [LLM_MODEL_NAME]: undefined,
};

describe("GeneratePostGraph", () => {
  it("Should be able to generate posts from a GitHub URL slack message", async () => {
    console.log("Starting graph test");
    const result = await generatePostGraph.stream(
      { links: GITHUB_URL_STATE.slackMessage.links },
      {
        streamMode: "values",
      },
    );

    let post = "";
    for await (const value of result) {
      console.log(
        "Event occurred",
        Object.entries(value).map(([k, v]) => ({
          [k]: !!v,
        })),
      );

      if (value.post) {
        post = value.post;
      }
    }

    if (post) {
      console.log("\nPOST:\n");
      console.log(post);
    }
  }, 60000);

  // Skip by default to prevent using up API quota
  it("Can read tweets via Twitter API", async () => {
    if (!process.env.TWITTER_BEARER_TOKEN) {
      throw new Error("TWITTER_BEARER_TOKEN is not set");
    }
    const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
    const singleTweet = await client.v2.singleTweet("1861528104901984330");
    expect(singleTweet.data.text).toBeDefined();
  });

  it("can resolve twitter URLs", async () => {
    const resolvedUrl = await resolveTwitterUrl("https://t.co/GI4uWOGPO5");
    expect(resolvedUrl).toBe(
      "https://twitter.com/GergelyOrosz/status/1861528104901984330/photo/1",
    );
  });
});

test("Can get the proper markdown from a github URL", async () => {
  const url = "https://github.com/bracesproul/langgraphjs-examples";
  const contents = await getGitHubContentsAndTypeFromUrl(url);
  if (!contents) {
    throw new Error("No contents found");
  }
  expect(contents.contents).toBe(EXPECTED_README);
});

describe("generate via twitter posts", () => {
  it("Can generate a post from a tweet with a github link", async () => {
    console.log("Starting graph test");
    const result = await generatePostGraph.stream(
      { links: TWITTER_NESTED_GITHUB_MESSAGE.slackMessage.links },
      {
        streamMode: "values",
      },
    );

    let post = "";
    for await (const value of result) {
      console.log(
        "Event occurred",
        Object.entries(value).map(([k, v]) => ({
          [k]: !!v,
        })),
      );

      if (value.post) {
        post = value.post;
      }
    }

    if (post) {
      console.log("\nPOST:\n");
      console.log(post);
    }
  }, 60000);
});

describe("generate via github repos", () => {
  it("Can generate a post from a github repo", async () => {
    console.log("Starting graph test");
    const result = await generatePostGraph.stream(
      { links: GITHUB_MESSAGE.slackMessage.links },
      {
        streamMode: "values",
      },
    );

    let post = "";
    for await (const value of result) {
      console.log(
        "Event occurred",
        Object.entries(value).map(([k, v]) => ({
          [k]: !!v,
        })),
      );

      if (value.post) {
        post = value.post;
      }
    }

    if (post) {
      console.log("\nPOST:\n");
      console.log(post);
    }
  }, 60000);
});

test("Can get video duration", async () => {
  const duration = await getYouTubeVideoDuration(
    "https://www.youtube.com/watch?v=BGvqeRB4Jpk",
  );
  expect(duration).toBe(91);
});

test("Can get page text", async () => {
  const text = await getPageText("https://buff.ly/4g0ZRXI");
  expect(text).toBeDefined();
  expect(text?.length).toBeGreaterThan(100);
});

test("can generate post", async () => {
  const result = await generatePostGraph.invoke(
    {
      links: ["https://x.com/eitanblumin/status/1861001933294653890"],
    },
    {
      configurable: {
        ...BASE_CONFIG,
      },
    },
  );
  console.log(result);
});

test("can generate summaries of youtube videos", async () => {
  const result = await verifyYouTubeContent(
    {
      link: "https://www.youtube.com/watch?v=BGvqeRB4Jpk",
    },
    {},
  );
  expect(result.pageContents).toBeDefined();
  expect(result.pageContents[0].length).toBeGreaterThan(50); // Check character count
});

test("can interrupt and resume", async () => {
  generatePostGraph.checkpointer = new MemorySaver();
  const config = {
    configurable: {
      ...BASE_CONFIG,
      thread_id: "123",
    },
  };
  await generatePostGraph.invoke(
    {
      links: ["https://github.com/langchain-ai/open-canvas"],
    },
    config,
  );
  console.log("interrupted first time");

  await generatePostGraph.invoke(
    new Command({
      resume: [
        {
          type: "response",
          args: "Add more emojis please",
        },
      ],
    }),
    config,
  );
});

test("Verify tweets returns valid media URLs when tweet has media", async () => {
  const result = await verifyTweetGraph.invoke({
    link: "https://x.com/LangChainAI/status/1869125903139402215",
  });

  console.log("result");
  console.dir(result, { depth: null });
});
