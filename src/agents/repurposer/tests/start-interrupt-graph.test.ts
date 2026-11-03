import http from "node:http";
import { expect, test } from "@jest/globals";
import { POST_TO_LINKEDIN_ORGANIZATION } from "../../generate-post/constants.js";
import { startInterruptGraphRuns } from "../nodes/start-interrupt-graph.js";
import { RepurposerState } from "../types.js";

async function readChildRunConfig(
  environmentValue: "true" | "false",
  parentValue?: boolean,
): Promise<unknown> {
  const requests: Array<{ method?: string; url?: string; body: string }> = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, body });
      res.setHeader("content-type", "application/json");

      if (req.method === "POST" && req.url === "/threads") {
        res.end(JSON.stringify({ thread_id: "thread-1" }));
        return;
      }

      if (req.method === "POST" && req.url?.includes("/runs")) {
        res.end(JSON.stringify({ run_id: "run-1" }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    });
  });

  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Failed to start test server");
  }

  const previousApiUrl = process.env.LANGGRAPH_API_URL;
  const previousPostToOrg = process.env.POST_TO_LINKEDIN_ORGANIZATION;

  try {
    process.env.LANGGRAPH_API_URL = `http://127.0.0.1:${address.port}`;
    process.env.POST_TO_LINKEDIN_ORGANIZATION = environmentValue;

    const state = {
      posts: [{ content: "p1", index: 0 }],
      images: [],
      originalLink: "https://example.com",
      originalContent: "orig",
      contextLinks: ["https://ctx.example.com"],
      additionalContexts: [],
      pageContents: [],
      quantity: 1,
      reports: [{ report: "report", keyDetails: "details" }],
      imageOptions: ["image option"],
      campaignPlan: "plan",
      userResponse: undefined,
      next: "unknownResponse",
      scheduleDate: undefined,
      numWeeksBetween: 1,
    } as RepurposerState;

    const config =
      parentValue === undefined
        ? undefined
        : {
            configurable: {
              [POST_TO_LINKEDIN_ORGANIZATION]: parentValue,
            },
          };

    await startInterruptGraphRuns(state, config);
  } finally {
    if (previousApiUrl === undefined) {
      delete process.env.LANGGRAPH_API_URL;
    } else {
      process.env.LANGGRAPH_API_URL = previousApiUrl;
    }

    if (previousPostToOrg === undefined) {
      delete process.env.POST_TO_LINKEDIN_ORGANIZATION;
    } else {
      process.env.POST_TO_LINKEDIN_ORGANIZATION = previousPostToOrg;
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const runRequest = requests.find((request) => request.url?.includes("/runs"));
  expect(runRequest).toBeDefined();

  const payload = JSON.parse(runRequest?.body ?? "{}");
  return payload.config;
}

test("parent false overrides an environment default of true", async () => {
  await expect(readChildRunConfig("true", false)).resolves.toEqual({
    configurable: {
      [POST_TO_LINKEDIN_ORGANIZATION]: false,
    },
  });
});

test("parent true overrides an environment default of false", async () => {
  await expect(readChildRunConfig("false", true)).resolves.toEqual({
    configurable: {
      [POST_TO_LINKEDIN_ORGANIZATION]: true,
    },
  });
});

test("uses the environment default when the parent config is absent", async () => {
  await expect(readChildRunConfig("false")).resolves.toEqual({
    configurable: {
      [POST_TO_LINKEDIN_ORGANIZATION]: false,
    },
  });
});
