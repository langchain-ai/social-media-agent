import { traceable } from "langsmith/traceable";
import type { TweetV2 } from "twitter-api-v2";

const CONTRACT_VERSION = "2026-04-29";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const SEARCH_URL = "https://xquik.com/api/v1/x/tweets/search";
const TIMEOUT_MS = 30_000;

type XquikAuthor = {
  id?: unknown;
};

type XquikTweet = {
  author?: XquikAuthor;
  bookmarkCount?: unknown;
  createdAt?: unknown;
  entities?: unknown;
  id?: unknown;
  lang?: unknown;
  likeCount?: unknown;
  noteTweet?: unknown;
  quoteCount?: unknown;
  replyCount?: unknown;
  retweetCount?: unknown;
  text?: unknown;
  viewCount?: unknown;
};

export type XquikLoaderOptions = {
  apiKey?: string;
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
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new Error(`Xquik search limit must be between 1 and ${MAX_LIMIT}.`);
  }
  return parsed;
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

export function normalizeXquikTweet(rawTweet: unknown): TweetV2 | undefined {
  const rawObject = getObject(rawTweet);
  if (!rawObject) {
    return undefined;
  }

  const tweet = rawObject as XquikTweet;
  const id = getString(tweet.id);
  const noteTweet = getObject(tweet.noteTweet);
  const noteText = getString(noteTweet?.text);
  const text = noteText || getString(tweet.text);
  if (!id || !text) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {
    edit_history_tweet_ids: [id],
    id,
    text,
  };
  if (noteText) {
    const noteEntities = getObject(noteTweet?.entities);
    normalized.note_tweet = noteEntities
      ? { entities: noteEntities, text: noteText }
      : { text: noteText };
  }

  const createdAt = getString(tweet.createdAt);
  if (createdAt) {
    normalized.created_at = createdAt;
  }

  const authorId = getString(tweet.author?.id);
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
  addMetric(metrics, "bookmark_count", tweet.bookmarkCount);
  if (Object.keys(metrics).length > 0) {
    normalized.public_metrics = metrics;
  }

  const entities = getObject(noteTweet?.entities) || getObject(tweet.entities);
  if (entities) {
    normalized.entities = entities;
  }

  return normalized as unknown as TweetV2;
}

export async function xquikLoaderFunc(
  options: XquikLoaderOptions = {},
): Promise<TweetV2[]> {
  const apiKey = getString(options.apiKey ?? process.env.XQUIK_API_KEY);
  if (!apiKey) {
    throw new Error("XQUIK_API_KEY is required for the Xquik source.");
  }

  const searchQuery = getString(
    options.searchQuery ?? process.env.XQUIK_SEARCH_QUERY,
  );
  if (!searchQuery) {
    throw new Error("XQUIK_SEARCH_QUERY is required for the Xquik source.");
  }

  const limit = getLimit(options.limit ?? process.env.XQUIK_SEARCH_LIMIT);
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("limit", String(limit));

  const fetchFn = options.fetchFn || fetch;
  const response = await fetchFn(url, {
    cache: "no-store",
    headers: {
      "x-api-key": apiKey,
      "xquik-api-contract": CONTRACT_VERSION,
    },
    method: "GET",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Xquik search failed with status ${response.status}.`);
  }

  const payload = getObject(await response.json());
  if (!payload || !Array.isArray(payload.tweets)) {
    throw new Error("Xquik search response did not include tweets.");
  }

  return payload.tweets
    .map(normalizeXquikTweet)
    .filter((tweet): tweet is TweetV2 => tweet !== undefined);
}

export const xquikLoader = traceable(xquikLoaderFunc, {
  name: "xquik-loader",
});
