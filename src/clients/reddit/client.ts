import Snoowrap, { Submission } from "snoowrap";
import fs from "fs/promises";
import path from "path";
import { getRedditUserlessToken } from "./get-user-less-token.js";
import { createDirIfNotExists } from "../../utils/create-dir.js";
import {
  SimpleRedditPost,
  SimpleRedditComment,
  SimpleRedditPostWithComments,
} from "./types.js";

const REDDIT_POST_URL_REGEX = /^\/r\/[\w-]+\/comments\/[\w-]+\/.+/;

function isRedditPostUrl(url: string): boolean {
  return REDDIT_POST_URL_REGEX.test(url);
}

export class RedditClient {
  snoowrapClient: Snoowrap;

  /**
   * Creates a new instance of RedditClient
   * @param accessToken - Reddit API access token
   */
  constructor(accessToken: string) {
    this.snoowrapClient = new Snoowrap({
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      accessToken,
      userAgent: "SocialMediaAgent/1.0.0",
    });
  }

  /**
   * Loads an existing access token or obtains a new one if expired
   * @returns Promise containing the access token string
   */
  static async loadOrRefreshAccessToken(): Promise<string> {
    const accessTokenSecretsDir = path.resolve("src/clients/reddit/.secrets");
    const accessTokenSecretPath = path.join(
      accessTokenSecretsDir,
      "access-token.json",
    );

    createDirIfNotExists(accessTokenSecretsDir);

    try {
      const accessToken: { accessToken: string; expiry: string } | undefined =
        JSON.parse(await fs.readFile(accessTokenSecretPath, "utf-8"));

      if (accessToken && new Date(accessToken.expiry) > new Date()) {
        return accessToken.accessToken;
      }
    } catch (_) {
      // no-op
    }

    const tokenRes = await getRedditUserlessToken();
    await fs.writeFile(
      accessTokenSecretPath,
      JSON.stringify({
        accessToken: tokenRes.access_token,
        expiry: new Date(Date.now() + tokenRes.expires_in * 1000).toISOString(),
      }),
      "utf-8",
    );
    return tokenRes.access_token;
  }

  /**
   * Creates a new RedditClient instance using userless authentication
   * @returns Promise containing a new RedditClient instance
   */
  static async fromUserless() {
    const token = await RedditClient.loadOrRefreshAccessToken();
    return new RedditClient(token);
  }

  /**
   * Retrieves top posts from a specified subreddit
   * @param subreddit - Name of the subreddit to fetch posts from
   * @param options - Optional configuration object
   * @param options.limit - Maximum number of posts to retrieve (default: 10)
   * @returns Promise containing an array of Snoowrap Submissions
   */
  async getTopPosts(
    subreddit: string,
    options?: {
      limit?: number;
    },
  ): Promise<Snoowrap.Submission[]> {
    const limitWithDefaults = options?.limit != null ? options.limit : 10;

    const posts = (await (this.snoowrapClient.getSubreddit(subreddit).getTop({
      time: "day",
      limit: limitWithDefaults,
    }) as any)) as Snoowrap.Submission[];

    return posts;
  }

  /**
   * Retrieves new posts from a specified subreddit
   * @param subreddit - Name of the subreddit to fetch posts from
   * @param options - Optional configuration object
   * @param options.limit - Maximum number of posts to retrieve (default: 10)
   * @returns Promise containing an array of Snoowrap Submissions
   */
  async getNewPosts(
    subreddit: string,
    options?: {
      limit?: number;
    },
  ): Promise<Snoowrap.Submission[]> {
    const limitWithDefaults = options?.limit != null ? options.limit : 10;

    const posts = (await (this.snoowrapClient.getSubreddit(subreddit).getNew({
      limit: limitWithDefaults,
    }) as any)) as Snoowrap.Submission[];

    return posts;
  }

  /**
   * Converts a Snoowrap Submission into a simplified post format
   * @param post - Snoowrap Submission object to simplify
   * @returns Simplified Reddit post object
   */
  simplifyPost(post: Snoowrap.Submission): SimpleRedditPost {
    return {
      id: post.id,
      title: post.title,
      url: post.url,
      created_utc: post.created_utc,
      selftext: post.selftext,
      score: post.score,
      upvote_ratio: post.upvote_ratio,
    };
  }

  /**
   * Retrieves comments from a specific Reddit post
   * @param postId - ID of the Reddit post
   * @param options - Optional configuration object
   * @param options.limit - Maximum number of comments to retrieve (default: 10)
   * @param options.depth - Maximum depth of nested comments to retrieve (default: 3)
   * @returns Promise containing an array of Snoowrap Comments
   */
  async getPostComments(
    postId: string,
    options?: {
      limit?: number;
      depth?: number;
    },
  ): Promise<Snoowrap.Comment[]> {
    const limitWithDefaults = options?.limit ?? 10;
    const depthWithDefaults = options?.depth ?? 3;

    const submission = this.snoowrapClient.getSubmission(postId);
    const comments = (await (submission.comments.fetchAll({
      // @ts-expect-error - Weird snoowrap types. Can ignore.
      limit: limitWithDefaults,
      depth: depthWithDefaults,
    }) as any)) as Snoowrap.Comment[];

    return comments;
  }

  /**
   * Converts a Snoowrap Comment into a simplified comment format.
   * Implemented as an arrow function class property to ensure correct `this` binding
   * when used as a callback in array methods like map().
   * @param comment - Snoowrap Comment object to simplify
   * @returns Simplified Reddit comment object with optional nested replies
   */
  simplifyComment = (comment: Snoowrap.Comment): SimpleRedditComment => {
    return {
      id: comment.id,
      author: comment.author.name,
      body: comment.body,
      created_utc: comment.created_utc,
      replies: comment.replies
        ? comment.replies?.map((reply) => this.simplifyComment(reply))
        : undefined,
    };
  };

  async getPostById(postId: string): Promise<any> {
    return await this.snoowrapClient.getSubmission(postId).fetch();
  }

  /**
   * Retrieves post data from a Reddit URL
   * @param url - Full Reddit post URL (e.g., https://www.reddit.com/r/subreddit/comments/postid/title/)
   * @returns Promise containing the post data
   * @throws Error if the URL is not a valid Reddit post URL
   */
  async getPostByURL(url: string): Promise<Submission> {
    // Extract post ID from URL - matches both old and new Reddit URL formats
    const urlPattern = /reddit\.com\/r\/[^/]+\/comments\/([a-zA-Z0-9]+)/;
    const match = url.match(urlPattern);

    if (!match) {
      throw new Error("Invalid Reddit post URL");
    }

    const postId = match[1];
    const submission = (await this.getPostById(postId)) as any;
    return submission as Submission;
  }

  async getSimplePostAndComments(
    idOrUrl: string,
  ): Promise<SimpleRedditPostWithComments> {
    let post: Submission;
    try {
      const url = new URL(idOrUrl);
      if (url) {
        post = await this.getPostByURL(idOrUrl);
      } else {
        throw new Error("Invalid URL");
      }
    } catch (_) {
      // Is an ID.
      post = await this.getPostById(idOrUrl);
    }

    // Check if this post is linking to another Reddit post
    if (post.url && isRedditPostUrl(post.url)) {
      const linkedPost = await this.getPostByURL(
        `https://reddit.com${post.url}`,
      );
      if (linkedPost) {
        const [comments, linkedComments] = await Promise.all([
          this.getPostComments(post.id, {
            limit: 10,
            depth: 3,
          }),
          this.getPostComments(linkedPost.id, {
            limit: 10,
            depth: 3,
          }),
        ]);

        const simplePost = this.simplifyPost(post);
        simplePost.selftext += `\n\nLinked post:\n${linkedPost.title}\n${linkedPost.selftext}`;
        if (linkedPost.url) {
          // The original post URL was linking to this post, so replace it with the linked post URL, if exists
          simplePost.url = linkedPost.url;
        }

        return {
          post: simplePost,
          // Simply concatenate comments from both posts.
          comments: comments
            .map(this.simplifyComment)
            .concat(linkedComments.map(this.simplifyComment)),
        };
      }
    }

    const comments = await this.getPostComments(post.id, {
      limit: 10, // default
      depth: 3, // default
    });

    return {
      post: this.simplifyPost(post),
      comments: comments.map(this.simplifyComment),
    };
  }
}
