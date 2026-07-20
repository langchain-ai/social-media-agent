import { describe, expect, it } from "@jest/globals";
import { normalizeXquikTweet, xquikLoaderFunc } from "../xquik.js";

describe("normalizeXquikTweet", () => {
  it("maps Xquik fields into the TweetV2 shape used by curation", () => {
    const tweet = normalizeXquikTweet({
      author: {
        id: "42",
        username: "LangChainAI",
      },
      createdAt: "2026-05-23T14:42:48.000Z",
      bookmarkCount: 4,
      id: "123",
      likeCount: 10,
      noteTweet: {
        entities: {
          urls: [
            {
              expanded_url: "https://blog.langchain.com/agents",
              url: "https://t.co/example",
            },
          ],
        },
        text: "Complete LangGraph agent post.",
      },
      replyCount: 2,
      retweetCount: 3,
      text: "Truncated post",
      viewCount: 1000,
    });

    expect(tweet).toBeDefined();
    expect(tweet?.id).toBe("123");
    expect(tweet?.text).toBe("Complete LangGraph agent post.");
    expect(tweet?.note_tweet?.text).toBe("Complete LangGraph agent post.");
    expect(tweet?.author_id).toBe("42");
    expect(tweet?.public_metrics?.like_count).toBe(10);
    expect(tweet?.public_metrics?.bookmark_count).toBe(4);
    expect(tweet?.created_at).toBe("2026-05-23T14:42:48.000Z");
    expect(tweet?.entities?.urls?.[0]?.expanded_url).toBe(
      "https://blog.langchain.com/agents",
    );
  });

  it("skips malformed Xquik records", () => {
    expect(normalizeXquikTweet({ id: "123" })).toBeUndefined();
    expect(normalizeXquikTweet(null)).toBeUndefined();
  });
});

describe("xquikLoaderFunc", () => {
  it("fetches a bounded page from the fixed Xquik endpoint", async () => {
    const apiKey = ["xq", "test-key"].join("_");
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      requests.push({ init, url: input.toString() });
      return new Response(
        JSON.stringify({
          tweets: [
            {
              author: { id: "42", username: "LangChainAI" },
              id: "456",
              text: "Xquik can provide public X context to this agent.",
            },
          ],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    };

    const tweets = await xquikLoaderFunc({
      apiKey,
      fetchFn,
      limit: 2,
      searchQuery: "LangGraph agent",
    });

    expect(tweets).toHaveLength(1);
    expect(tweets[0]?.id).toBe("456");
    expect(requests[0]?.url).toBe(
      "https://xquik.com/api/v1/x/tweets/search?q=LangGraph+agent&limit=2",
    );
    expect(requests[0]?.init?.headers).toEqual({
      "x-api-key": apiKey,
      "xquik-api-contract": "2026-04-29",
    });
    expect(requests[0]?.init?.method).toBe("GET");
    expect(requests[0]?.init?.signal).toBeDefined();
  });

  it("rejects missing configuration before making a request", async () => {
    const fetchFn: typeof fetch = async () => {
      throw new Error("fetch must not run");
    };

    await expect(
      xquikLoaderFunc({ apiKey: "", fetchFn, searchQuery: "LangGraph" }),
    ).rejects.toThrow("XQUIK_API_KEY");
    await expect(
      xquikLoaderFunc({ apiKey: "xq_test", fetchFn, searchQuery: "" }),
    ).rejects.toThrow("XQUIK_SEARCH_QUERY");
    await expect(
      xquikLoaderFunc({
        apiKey: "xq_test",
        fetchFn,
        limit: 201,
        searchQuery: "LangGraph",
      }),
    ).rejects.toThrow("between 1 and 200");
    await expect(
      xquikLoaderFunc({
        apiKey: "xq_test",
        fetchFn,
        limit: 1.5,
        searchQuery: "LangGraph",
      }),
    ).rejects.toThrow("between 1 and 200");
  });

  it("does not expose credentials or response bodies in errors", async () => {
    const apiKey = ["xq", "secret-value"].join("_");
    const fetchFn: typeof fetch = async () =>
      new Response("private upstream details", { status: 500 });

    const request = xquikLoaderFunc({
      apiKey,
      fetchFn,
      searchQuery: "LangGraph",
    });

    await expect(request).rejects.toThrow("status 500");
    await expect(request).rejects.not.toThrow(apiKey);
    await expect(request).rejects.not.toThrow("private upstream details");
  });

  it("rejects malformed success payloads", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ tweets: null }), { status: 200 });

    await expect(
      xquikLoaderFunc({
        apiKey: "xq_test",
        fetchFn,
        searchQuery: "LangGraph",
      }),
    ).rejects.toThrow("did not include tweets");
  });
});
