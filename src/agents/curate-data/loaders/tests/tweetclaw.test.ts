import { describe, expect, it } from "@jest/globals";
import { normalizeTweetClawTweet, tweetclawLoaderFunc } from "../tweetclaw.js";

describe("normalizeTweetClawTweet", () => {
  it("maps TweetClaw fields into the TweetV2 shape used by curation", () => {
    const tweet = normalizeTweetClawTweet({
      author: {
        id: "42",
        username: "LangChainAI",
      },
      created: "2026-05-23T14:42:48.000Z",
      id: "123",
      likeCount: 10,
      replyCount: 2,
      retweetCount: 3,
      text: "LangGraph agents can now use public X context.",
      url: "https://x.com/LangChainAI/status/123",
      viewCount: 1000,
    });

    expect(tweet).toBeDefined();
    expect(tweet?.id).toBe("123");
    expect(tweet?.text).toContain("LangGraph agents");
    expect(tweet?.author_id).toBe("42");
    expect(tweet?.public_metrics?.like_count).toBe(10);
    expect(tweet?.entities?.urls?.[0]?.expanded_url).toBe(
      "https://x.com/LangChainAI/status/123",
    );
  });

  it("skips malformed TweetClaw records", () => {
    expect(normalizeTweetClawTweet({ id: "123" })).toBeUndefined();
    expect(normalizeTweetClawTweet(null)).toBeUndefined();
  });
});

describe("tweetclawLoaderFunc", () => {
  it("fetches TweetClaw search results with API key auth", async () => {
    const apiKey = ["xq", "test-key"].join("_");
    const requests: Array<{ headers: HeadersInit | undefined; url: string }> =
      [];
    const fetchFn: typeof fetch = async (input, init) => {
      requests.push({
        headers: init?.headers,
        url: input.toString(),
      });

      return new Response(
        JSON.stringify({
          tweets: [
            {
              author: { username: "LangChainAI" },
              id: "456",
              text: "TweetClaw can provide search tweets to this agent.",
            },
          ],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    };

    const tweets = await tweetclawLoaderFunc({
      apiKey,
      baseUrl: "https://xquik.com",
      fetchFn,
      limit: 2,
      searchQuery: "LangGraph agent",
    });

    expect(tweets).toHaveLength(1);
    expect(tweets[0]?.id).toBe("456");
    expect(requests[0]?.url).toBe(
      "https://xquik.com/api/v1/x/tweets/search?q=LangGraph+agent&limit=2",
    );
    expect((requests[0]?.headers as Record<string, string>)["x-api-key"]).toBe(
      apiKey,
    );
  });
});
