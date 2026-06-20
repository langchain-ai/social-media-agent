import { TweetV2 } from "twitter-api-v2";
import { traceable } from "langsmith/traceable";

const DEFAULT_BASE_URL = "https://xquik.com";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const SEARCH_PATH = "/api/v1/x/tweets/search";

type TweetClawAuthor = {
  id?: unknown;
  name?: unknown;
  username?: unknown;
};

type TweetClawTweet = {
  author?: TweetClawAuthor;
  created?: unknown;
  entities?: unknown;
  id?: unknown;
  lang?: unknown;
  likeCount?: unknown;
  media?: unknown;
  quoteCount?: unknown;
  replyCount?: unknown;
  retweetCount?: unknown;
  text?: unknown;
  url?: unknown;
  viewCount?: unknown;
};

type TweetClawSearchResponse = {
  tweets?: unknown;
};

export type TweetClawLoaderOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  limit?: number | string;
  searchQuery?: string;
};

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function getObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function getLimit(value: number | string | undefined): number {
  if (value === undefined || value === "") {
    return DEFAULT_LIMIT;
  }
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("TweetClaw search limit must be a positive number.");
  }
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

function getBaseUrl(value: string | undefined): URL {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (url.protocol !== "https:") {
    throw new Error("TweetClaw base URL must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("TweetClaw base URL must not include credentials.");
  }
  return url;
}

function getHeaders(apiKey: string): Record<string, string> {
  if (apiKey.startsWith("xq_")) {
    return { "x-api-key": apiKey };
  }
  return { authorization: `Bearer ${apiKey}` };
}

function addMetric(
  metrics: Record<string, number>,
  key: string,
  value: unknown,
): void {
  const metric = getNumber(value);
  if (metric !== undefined) {
    metrics[key] = metric;
  }
}

function getTweetUrl(tweet: TweetClawTweet): string | undefined {
  const explicitUrl = getString(tweet.url);
  if (explicitUrl) {
    return explicitUrl;
  }
  const author = tweet.author;
  const username = getString(author?.username);
  const id = getString(tweet.id);
  if (username && id) {
    return `https://x.com/${username}/status/${id}`;
  }
  return undefined;
}

export function normalizeTweetClawTweet(
  rawTweet: unknown,
): TweetV2 | undefined {
  const rawObject = getObject(rawTweet);
  if (!rawObject) {
    return undefined;
  }

  const tweet = rawObject as TweetClawTweet;
  const id = getString(tweet.id);
  const text = getString(tweet.text);
  if (!id || !text) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {
    edit_history_tweet_ids: [id],
    id,
    text,
  };
  const createdAt = getString(tweet.created);
  if (createdAt) {
    normalized.created_at = createdAt;
  }

  const author = tweet.author;
  const authorId = getString(author?.id);
  if (authorId) {
    normalized.author_id = authorId;
  }

  const lang = getString(tweet.lang);
  if (lang) {
    normalized.lang = lang;
  }

  const metrics: Record<string, number> = {};
  addMetric(metrics, "like_count", tweet.likeCount);
  addMetric(metrics, "retweet_count", tweet.retweetCount);
  addMetric(metrics, "reply_count", tweet.replyCount);
  addMetric(metrics, "quote_count", tweet.quoteCount);
  addMetric(metrics, "impression_count", tweet.viewCount);
  if (Object.keys(metrics).length > 0) {
    normalized.public_metrics = metrics;
  }

  const url = getTweetUrl(tweet);
  if (url) {
    normalized.entities = {
      urls: [{ display_url: url, end: 0, expanded_url: url, start: 0, url }],
    };
  }

  return normalized as unknown as TweetV2;
}

async function tweetclawLoaderFunc(
  options: TweetClawLoaderOptions = {},
): Promise<TweetV2[]> {
  const apiKey = options.apiKey || process.env.XQUIK_API_KEY;
  if (!apiKey) {
    throw new Error("XQUIK_API_KEY is required for the TweetClaw source.");
  }

  const searchQuery = options.searchQuery || process.env.TWEETCLAW_SEARCH_QUERY;
  if (!searchQuery) {
    throw new Error(
      "TWEETCLAW_SEARCH_QUERY is required for the TweetClaw source.",
    );
  }

  const limit = getLimit(options.limit || process.env.TWEETCLAW_SEARCH_LIMIT);
  const url = new URL(SEARCH_PATH, getBaseUrl(options.baseUrl));
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("limit", String(limit));

  const fetchFn = options.fetchFn || fetch;
  const response = await fetchFn(url, {
    headers: getHeaders(apiKey),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`TweetClaw search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as TweetClawSearchResponse;
  if (!Array.isArray(payload.tweets)) {
    throw new Error("TweetClaw search response did not include tweets.");
  }

  return payload.tweets
    .map(normalizeTweetClawTweet)
    .filter((tweet): tweet is TweetV2 => tweet !== undefined);
}

export { tweetclawLoaderFunc };

export const tweetclawLoader = traceable(tweetclawLoaderFunc, {
  name: "tweetclaw-loader",
});
