import Arcade from "@arcadeai/arcadejs";
import { CreateTweetRequest, TwitterClientArgs } from "./types.js";
import {
  SendTweetV2Params,
  TweetV2,
  Tweetv2FieldsParams,
  TweetV2ListTweetsPaginator,
  TweetV2PaginableListParams,
  TweetV2SingleResult,
  TwitterApi,
  TwitterApiReadWrite,
} from "twitter-api-v2";
import { AuthorizeUserResponse } from "../types.js";
import {
  isTextOnly,
  useArcadeAuth,
  useTwitterApiOnly,
} from "../../agents/utils.js";

const BASE_FETCH_TWEET_OPTIONS: Partial<TweetV2PaginableListParams> = {
  "tweet.fields": [
    "note_tweet",
    "created_at",
    "id",
    "author_id",
    "in_reply_to_user_id",
    "referenced_tweets",
  ],
  "user.fields": ["username"],
  expansions: [
    "referenced_tweets.id",
    "referenced_tweets.id.author_id",
    "attachments.media_keys",
  ],
  "media.fields": ["type", "url"],
};

type MediaIdStringArray =
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string];

/**
 * TwitterClient class that provides methods for interacting with the Twitter API.
 * This client supports two authentication modes:
 * 1. Basic Twitter Auth - Uses direct Twitter API credentials from environment variables
 * 2. Arcade Auth - Uses Arcade's OAuth flow for enhanced security and user management
 *
 * Basic Auth requires these environment variables:
 * - TWITTER_USER_TOKEN
 * - TWITTER_USER_TOKEN_SECRET
 * - TWITTER_API_KEY
 * - TWITTER_API_KEY_SECRET
 *
 * Arcade Auth requires:
 * - ARCADE_API_KEY environment variable
 * - User tokens obtained through OAuth flow
 */
export class TwitterClient {
  private twitterClient: TwitterApi;

  private twitterClientOauth2?: TwitterApi;

  private twitterToken: string | undefined;

  private twitterTokenSecret: string | undefined;

  /**
   * Initializes a new TwitterClient instance.
   *
   * @param {TwitterClientArgs} args - Configuration options for the Twitter client
   * @param {TwitterApi} args.twitterClient - An initialized Twitter API client instance
   * @param {boolean} [args.useArcade] - Whether to use Arcade authentication mode
   * @param {string} [args.twitterToken] - Twitter access token (required if useArcade is true)
   * @param {string} [args.twitterTokenSecret] - Twitter access token secret (required if useArcade is true)
   * @throws {Error} If required tokens are missing when using Arcade mode
   */
  constructor(args: TwitterClientArgs) {
    this.twitterClient = args.twitterClient;
    this.twitterClientOauth2 = args.twitterClientOauth2;
    const textOnlyMode =
      args.textOnlyMode != null ? args.textOnlyMode : isTextOnly();

    // If we want to use Arcade, we need to set the token and token secret for uploading media.
    // However, this should only be done if text only mode is false.
    if (args.useArcade && !textOnlyMode) {
      const { twitterToken, twitterTokenSecret } = {
        twitterToken: args.twitterToken || process.env.TWITTER_USER_TOKEN,
        twitterTokenSecret:
          args.twitterTokenSecret || process.env.TWITTER_USER_TOKEN_SECRET,
      };
      if (!twitterToken || !twitterTokenSecret) {
        throw new Error(
          "Missing Twitter user credentials in Arcade mode.\n" +
            `TWITTER_USER_TOKEN: ${!!twitterToken}\n` +
            `TWITTER_USER_TOKEN_SECRET: ${!!twitterTokenSecret}\n`,
        );
      }

      this.twitterToken = twitterToken;
      this.twitterTokenSecret = twitterTokenSecret;
    }
  }

  /**
   * Authorizes a user through Arcade's OAuth flow for Twitter access.
   * This method is used exclusively in Arcade authentication mode.
   *
   * @param {string} id - The user's unique identifier in your system
   * @param {Arcade} client - An initialized Arcade client instance
   * @returns {Promise<AuthorizeUserResponse>} Object containing either an authorization URL or token
   * @throws {Error} If authorization fails or required tokens are missing
   */
  static async authorizeUser(
    id: string,
    client: Arcade,
  ): Promise<AuthorizeUserResponse> {
    const authRes = await client.auth.start(id, "x", {
      scopes: ["tweet.write", "users.read", "tweet.read", "offline.access"],
    });

    if (authRes.status === "completed") {
      if (!authRes.context?.token) {
        throw new Error(
          "Authorization status is completed, but token not found",
        );
      }
      return { token: authRes.context.token };
    }

    if (authRes.url) {
      return { authorizationUrl: authRes.url };
    }

    throw new Error(
      `Authorization failed for user ID: ${id}\nStatus: '${authRes.status}'`,
    );
  }

  /**
   * Creates a TwitterClient instance using basic Twitter authentication.
   * This method requires the following environment variables to be set:
   * - TWITTER_USER_TOKEN
   * - TWITTER_USER_TOKEN_SECRET
   * - TWITTER_API_KEY
   * - TWITTER_API_KEY_SECRET
   *
   * @returns {TwitterClient} A new TwitterClient instance
   * @throws {Error} If any required Twitter credentials are missing
   */
  static fromBasicTwitterAuth(): TwitterClient {
    if (
      !process.env.TWITTER_USER_TOKEN ||
      !process.env.TWITTER_USER_TOKEN_SECRET
    ) {
      throw new Error(
        "Missing Twitter user credentials.\n" +
          `TWITTER_USER_TOKEN: ${!!process.env.TWITTER_USER_TOKEN}\n` +
          `TWITTER_USER_TOKEN_SECRET: ${!!process.env.TWITTER_USER_TOKEN_SECRET}\n`,
      );
    }
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_KEY_SECRET) {
      throw new Error(
        "Missing Twitter app credentials.\n" +
          `TWITTER_API_KEY: ${!!process.env.TWITTER_API_KEY}\n` +
          `TWITTER_API_KEY_SECRET: ${!!process.env.TWITTER_API_KEY_SECRET}\n`,
      );
    }

    const twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_KEY_SECRET,
      accessToken: process.env.TWITTER_USER_TOKEN,
      accessSecret: process.env.TWITTER_USER_TOKEN_SECRET,
    });

    const twitterClientOauth2 = process.env.TWITTER_BEARER_TOKEN
      ? new TwitterApi(process.env.TWITTER_BEARER_TOKEN)
      : undefined;

    return new TwitterClient({
      twitterClient,
      twitterClientOauth2,
    });
  }

  /**
   * Creates a TwitterClient instance using Arcade authentication.
   * This method handles the OAuth flow through Arcade's service.
   *
   * @param {string} twitterUserId - The user's Twitter ID
   * @param {{ twitterToken: string; twitterTokenSecret: string }} tokens - Object containing Twitter tokens
   * @returns {Promise<TwitterClient>} A new TwitterClient instance
   * @throws {Error} If user is not authorized or if authorization fails
   */
  static async fromArcade(
    twitterUserId: string,
    tokens: {
      twitterToken: string | undefined;
      twitterTokenSecret: string | undefined;
    },
    options?: {
      textOnlyMode?: boolean;
    },
  ): Promise<TwitterClient> {
    const arcadeClient = new Arcade({ apiKey: process.env.ARCADE_API_KEY });
    const authResponse = await TwitterClient.authorizeUser(
      twitterUserId,
      arcadeClient,
    );
    if (authResponse.authorizationUrl) {
      throw new Error(
        `User not authorized. Please visit ${authResponse.authorizationUrl} to authorize the user.`,
      );
    }
    if (!authResponse.token) {
      throw new Error("Authorization token not found");
    }
    const tokenContext = authResponse.token;
    const twitterClient = new TwitterApi(tokenContext);
    return new TwitterClient({
      twitterClient,
      useArcade: true,
      ...tokens,
      ...options,
    });
  }

  /**
   * Posts a tweet with optional media attachment.
   * Works in both basic auth and Arcade auth modes.
   *
   * @param {CreateTweetRequest} params - The tweet parameters
   * @param {string} params.text - The text content of the tweet
   * @param {{ media: Buffer; mimeType: string }} [params.media] - Optional media attachment
   * @returns {Promise<any>} The Twitter API response
   * @throws {Error} If the tweet upload fails
   */
  async uploadTweet({ text, media }: CreateTweetRequest) {
    let mediaIds: MediaIdStringArray | undefined = undefined;
    if (media?.media) {
      const mediaId = await this.uploadMedia(media.media, media.mimeType);
      mediaIds = [mediaId];
    }
    const mediaInput = mediaIds
      ? {
          media: {
            media_ids: mediaIds,
          },
        }
      : {};

    const response = await this.twitterClient.v2.tweet({
      text,
      ...mediaInput,
    });

    if (response.errors) {
      throw new Error(
        `Error uploading tweet: ${JSON.stringify(response.errors, null)}`,
      );
    }
    return response;
  }

  /**
   * Posts a sequence of tweets as a thread, with optional media for each post.
   * Works in both basic auth and Arcade auth modes.
   *
   * @param {CreateTweetRequest[]} posts - An array of tweet objects, each containing text and optional media.
   * @returns {Promise<any[]>} A promise resolving to an array of Twitter API responses for each tweet in the thread.
   * @throws {Error} If any tweet in the thread upload fails.
   */
  async uploadThread(posts: CreateTweetRequest[]) {
    const postsInputPromise: Promise<SendTweetV2Params>[] = posts.map(
      async (p) => {
        let mediaIds: MediaIdStringArray | undefined = undefined;
        if (p.media?.media) {
          const mediaId = await this.uploadMedia(
            p.media.media,
            p.media.mimeType,
          );
          mediaIds = [mediaId];
        }
        const mediaInput = mediaIds
          ? {
              media: {
                media_ids: mediaIds,
              },
            }
          : {};

        return {
          text: p.text,
          ...mediaInput,
        };
      },
    );
    const threadPostsInput = await Promise.all(postsInputPromise);
    const response = await this.twitterClient.v2.tweetThread(threadPostsInput);
    if (response.some((r) => r.errors)) {
      throw new Error(
        `Error uploading thread: ${JSON.stringify(
          response.map((r) => r.errors),
          null,
        )}`,
      );
    }
    return response;
  }

  /**
   * Tests if the current Twitter credentials are valid.
   * Works in both basic auth and Arcade auth modes.
   *
   * @returns {Promise<boolean>} True if authentication is successful, false otherwise
   */
  async testAuthentication() {
    try {
      const authorized = await this.twitterClient.v2.me();
      return !!authorized;
    } catch (error) {
      console.warn("Error checking user authorization:", error);
      return false;
    }
  }

  /**
   * Uploads media to Twitter for use in tweets.
   * Handles authentication differently based on whether using basic auth or Arcade auth.
   *
   * @param {Buffer} media - The media buffer to upload
   * @param {string} mimeType - The MIME type of the media
   * @returns {Promise<string>} The media ID string from Twitter
   * @throws {Error} If media upload fails or if required credentials are missing
   */
  async uploadMedia(media: Buffer, mimeType: string): Promise<string> {
    let client: TwitterApiReadWrite;

    // If the token & token secret are not set, this indicates they've already been set on the client.
    if (!this.twitterToken || !this.twitterTokenSecret) {
      client = this.twitterClient.readWrite;
    } else {
      if (!process.env.TWITTER_API_KEY_SECRET || !process.env.TWITTER_API_KEY) {
        throw new Error(
          "Missing twitter credentials.\n" +
            `TWITTER_API_KEY_SECRET: ${!!process.env.TWITTER_API_KEY_SECRET}\n` +
            `TWITTER_API_KEY: ${!!process.env.TWITTER_API_KEY}\n`,
        );
      }

      client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_KEY_SECRET,
        accessToken: this.twitterToken,
        accessSecret: this.twitterTokenSecret,
      }).readWrite;
    }

    try {
      // Ensure media is a Buffer
      if (!Buffer.isBuffer(media)) {
        throw new Error("Media must be a Buffer");
      }

      // Upload the media directly using the buffer
      const mediaResponse = await client.v1.uploadMedia(media, {
        mimeType,
      });

      return mediaResponse;
    } catch (error: any) {
      throw new Error(`Failed to upload media: ${error.message}`);
    }
  }

  /**
   * Get a tweet by ID using the basic Twitter API. Will return undefined if an error occurs.
   * @param id The tweet ID
   * @returns {Promise<TweetV2SingleResult>} The tweet
   */
  private async getTweetBasicAuth(
    id: string,
    tweetOptions?: Partial<Tweetv2FieldsParams>,
  ): Promise<TweetV2SingleResult | undefined> {
    const fetchTweetOptions: Partial<Tweetv2FieldsParams> = {
      ...BASE_FETCH_TWEET_OPTIONS,
      ...(tweetOptions || {}),
    };
    const tweetContent = await this.twitterClient.v2.singleTweet(
      id,
      fetchTweetOptions,
    );
    return tweetContent;
  }

  /**
   * Get a tweet by ID using the Arcade Twitter API tool.
   * @param id The tweet ID
   * @param twitterUserId The user ID making the request
   * @returns {Promise<TweetV2SingleResult>}
   */
  private async getTweetArcade(
    id: string,
    twitterUserId: string,
  ): Promise<TweetV2SingleResult> {
    const arcade = new Arcade({
      apiKey: process.env.ARCADE_API_KEY,
    });

    const result = await arcade.tools.execute({
      tool_name: "X.LookupTweetById",
      input: { tweet_id: id },
      user_id: twitterUserId,
    });

    return result.output?.value as TweetV2SingleResult;
  }

  /**
   * Retrieves a tweet by its ID. The method supports both basic Twitter authentication and Arcade authentication modes.
   *
   * When using basic Twitter auth (USE_ARCADE_AUTH="false"):
   * - Uses the Twitter API v2 endpoint directly
   * - Requires standard Twitter API credentials to be set in environment variables
   *
   * When using Arcade auth (USE_ARCADE_AUTH="true"):
   * - Uses Arcade's X.LookupTweetById tool
   * - Requires ARCADE_API_KEY environment variable
   * - Requires twitterUserId parameter
   *
   * @param {string} id - The ID of the tweet to retrieve
   * @param {Object} [fields] - Optional parameters for the tweet lookup
   * @param {string} [fields.twitterUserId] - Required when using Arcade auth. The Twitter user ID making the request
   * @param {boolean} [fields.includeMedia=true] - Whether to include media attachments in the response
   * @returns {Promise<TweetV2SingleResult>} The tweet data including text, media (if requested), and other metadata
   * @throws {Error} When using Arcade auth without providing twitterUserId
   *
   * @example
   * ```typescript
   * // Using basic Twitter auth
   * const tweet = await client.getTweet("1234567890");
   *
   * // Using Arcade auth
   * const tweet = await client.getTweet("1234567890", { twitterUserId: "user123" });
   *
   * // Without media attachments
   * const tweet = await client.getTweet("1234567890");
   * ```
   */
  async getTweet(
    id: string,
    fields?: {
      twitterUserId?: string;
    },
  ): Promise<TweetV2SingleResult> {
    if (useTwitterApiOnly() || !useArcadeAuth()) {
      // Use the developer API account for reading tweets, not Arcade.
      const fetchTweetOptions: Partial<Tweetv2FieldsParams> =
        BASE_FETCH_TWEET_OPTIONS;

      const tweetContent = await this.getTweetBasicAuth(id, fetchTweetOptions);

      // If tweetContent is defined, return it. Otherwise fallback to Arcade.
      if (tweetContent) {
        return tweetContent;
      }

      throw new Error("Tweet not found");
    }

    if (!fields?.twitterUserId) {
      throw new Error("Must provide Twitter User ID when using Arcade auth.");
    }

    return this.getTweetArcade(id, fields.twitterUserId);
  }

  /**
   * Get tweets from a Twitter list.
   * @param listId The ID of the Twitter list
   * @param fields
   * @param fields.maxResults The maximum number of tweets to fetch
   * @returns {Promise<TweetV2ListTweetsPaginator>} A paginator for the list of tweets
   */
  async getListTweets(
    listId: string,
    fields?: {
      maxResults?: number;
      paginationToken?: string;
    },
  ): Promise<TweetV2ListTweetsPaginator> {
    const fieldsWithDefaults = {
      maxResults: 100,
      ...fields,
    };
    const fetchTweetOptions: Partial<TweetV2PaginableListParams> =
      BASE_FETCH_TWEET_OPTIONS;

    if (fieldsWithDefaults.paginationToken) {
      fetchTweetOptions.pagination_token = fieldsWithDefaults.paginationToken;
    }

    const listTweets = await this.twitterClient.v2.listTweets(listId, {
      max_results: fieldsWithDefaults.maxResults,
      ...fetchTweetOptions,
    });

    return listTweets;
  }

  /**
   * Searches for tweets using the Twitter API v2 endpoint
   * @param query - The search query string to find relevant tweets
   * @param options - Optional configuration for the search
   * @param options.maxResults - Maximum number of tweets to return (default: 15)
   * @param options.sinceId - Only return tweets newer than this ID
   * @returns {Promise<TweetSearchRecentV2Paginator>} A promise that resolves to the search results
   */
  async searchTweets(
    query: string,
    options?: {
      maxResults?: number;
      sinceId?: string;
    },
  ) {
    const fetchTweetOptions: Partial<Tweetv2FieldsParams> =
      BASE_FETCH_TWEET_OPTIONS;

    const tweets = await this.twitterClient.v2.search(query, {
      ...fetchTweetOptions,
      max_results: options?.maxResults || 15,
      since_id: options?.sinceId,
    });
    return tweets;
  }

  /**
   * Retrieves all tweets in a thread starting from a given tweet ID.
   * A thread is defined as a series of tweets where the author replies to their own tweets.
   *
   * @param {string} id - The ID of the initial tweet in the thread
   * @param {string} username - The username of the author who created the thread
   * @returns {Promise<TweetV2[]>} An array of tweets in chronological order. This does NOT include the initial tweet, only the replies.
   */
  async getThreadReplies(id: string, username: string): Promise<TweetV2[]> {
    if (!this.twitterClientOauth2) {
      console.error("Twitter client OAuth2 is not initialized.");
      return [];
    }
    const fetchTweetOptions: Partial<Tweetv2FieldsParams> =
      BASE_FETCH_TWEET_OPTIONS;

    const thread: TweetV2[] = [];

    // Search for replies by the same author, to the same author. This must result in a thread, or the author is replying to themselves.
    const query = `conversation_id:${id} from:${username} to:${username}`;

    const replies = await this.twitterClientOauth2.v2.searchAll(query, {
      ...fetchTweetOptions,
      sort_order: "recency",
      max_results: 15, // Limit to 15 replies as most threads will not be longer than this.
    });

    if (!replies.data || !replies.data.data) {
      return thread;
    }

    return replies.data.data;
  }
}

/**
 * Gets a TwitterClient instance. Will use Arcade auth if USE_ARCADE_AUTH is true, otherwise will use basic auth.
 * @returns A TwitterClient instance.
 */
export async function getTwitterClient(): Promise<TwitterClient> {
  if (useTwitterApiOnly() || !useArcadeAuth()) {
    return TwitterClient.fromBasicTwitterAuth();
  } else {
    const twitterUserId = process.env.TWITTER_USER_ID;
    if (!twitterUserId) {
      throw new Error("Twitter user ID not found in configurable fields.");
    }

    const twitterToken = process.env.TWITTER_USER_TOKEN;
    const twitterTokenSecret = process.env.TWITTER_USER_TOKEN_SECRET;

    return TwitterClient.fromArcade(twitterUserId, {
      twitterToken,
      twitterTokenSecret,
    });
  }
}
