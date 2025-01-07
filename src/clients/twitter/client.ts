import Arcade from "@arcadeai/arcadejs";
import {
  AuthorizeUserResponse,
  CreateTweetRequest,
  TwitterClientArgs,
} from "./types.js";
import { TwitterApi, TwitterApiReadWrite } from "twitter-api-v2";

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

    // If we want to use Arcade, we need to set the token and token secret.
    if (args.useArcade) {
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
    const authRes = await client.auth.authorize({
      user_id: id,
      auth_requirement: {
        provider_id: "x",
        oauth2: {
          scopes: ["tweet.read", "tweet.write"],
        },
      },
    });

    if (authRes.status === "completed") {
      if (!authRes.context?.token) {
        throw new Error(
          "Authorization status is completed, but token not found",
        );
      }
      return { token: authRes.context.token };
    }

    if (authRes.authorization_url) {
      return { authorizationUrl: authRes.authorization_url };
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
    return new TwitterClient({
      twitterClient,
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
      twitterToken: string;
      twitterTokenSecret: string;
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
      ...tokens,
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
}
