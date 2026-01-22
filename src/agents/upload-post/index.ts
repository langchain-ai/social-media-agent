import {
  Annotation,
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { TwitterClient } from "../../clients/twitter/client.js";
import {
  imageUrlToBuffer,
  isTextOnly,
  shouldPostToLinkedInOrg,
  useArcadeAuth,
  useTwitterApiOnly,
} from "../utils.js";
import { CreateMediaRequest } from "../../clients/twitter/types.js";
import { LinkedInClient } from "../../clients/linkedin.js";
import {
  LINKEDIN_ACCESS_TOKEN,
  LINKEDIN_ORGANIZATION_ID,
  LINKEDIN_PERSON_URN,
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
  TWITTER_MAIN_USER_TOKEN,
  TWITTER_MAIN_USER_TOKEN_SECRET,
  LINKEDIN_MAIN_ACCESS_TOKEN,
  LINKEDIN_MAIN_ORGANIZATION_ID,
} from "../generate-post/constants.js";
import { TwitterApi } from "twitter-api-v2";
import { SlackClient } from "../../clients/slack/client.js";
import { ComplexPost } from "../shared/nodes/generate-post/types.js";

async function getMediaFromImage(image?: {
  imageUrl: string;
  mimeType: string;
}): Promise<CreateMediaRequest | undefined> {
  if (!image) return undefined;
  const { buffer, contentType } = await imageUrlToBuffer(image.imageUrl);
  return {
    media: buffer,
    mimeType: contentType,
  };
}

function ensureSignature(text: string): string {
  const prefix = "LangChain Community Spotlight:";
  if (text.toLowerCase().includes(prefix.toLowerCase())) {
    return text;
  }
  return `${prefix} ${text}`;
}

async function retweetFromMainAccount(tweetId: string): Promise<void> {
  const mainUserToken = process.env[TWITTER_MAIN_USER_TOKEN];
  const mainUserTokenSecret = process.env[TWITTER_MAIN_USER_TOKEN_SECRET];

  if (!mainUserToken || !mainUserTokenSecret) {
    console.log(
      "Main Twitter account credentials not configured. Skipping retweet.",
    );
    return;
  }

  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_KEY_SECRET) {
    console.warn("Twitter API keys not configured. Skipping retweet.");
    return;
  }

  try {
    const mainClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_KEY_SECRET,
      accessToken: mainUserToken,
      accessSecret: mainUserTokenSecret,
    });

    const me = await mainClient.v2.me();
    await mainClient.v2.retweet(me.data.id, tweetId);
    console.log("✅ Successfully retweeted from main Twitter account ✅");
  } catch (error) {
    console.error("Failed to retweet from main account (non-blocking):", error);
  }
}

async function reshareFromMainLinkedInAccount(
  originalPostUrn: string,
): Promise<void> {
  const mainAccessToken = process.env[LINKEDIN_MAIN_ACCESS_TOKEN];
  const mainOrgId = process.env[LINKEDIN_MAIN_ORGANIZATION_ID];

  if (!mainAccessToken || !mainOrgId) {
    console.log(
      "Main LinkedIn account credentials not configured. Skipping reshare.",
    );
    return;
  }

  try {
    const reshareData = {
      owner: `urn:li:organization:${mainOrgId}`,
      resharedShare: originalPostUrn,
      distribution: {
        linkedInDistributionTarget: {},
      },
      text: {
        text: "",
      },
    };

    const response = await fetch("https://api.linkedin.com/v2/shares", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mainAccessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(reshareData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LinkedIn reshare failed: ${response.status} ${errorText}`,
      );
    }

    console.log("✅ Successfully reshared from main LinkedIn account ✅");
  } catch (error) {
    console.error(
      "Failed to reshare from main LinkedIn account (non-blocking):",
      error,
    );
  }
}

const UploadPostAnnotation = Annotation.Root({
  post: Annotation<string>,
  /**
   * The complex post, if the user decides to split the URL from the main body.
   *
   * TODO: Refactor the post/complexPost state interfaces to use a single shared interface
   * which includes images too.
   * Tracking issue: https://github.com/langchain-ai/social-media-agent/issues/144
   */
  complexPost: Annotation<ComplexPost | undefined>,
  image: Annotation<
    | {
        imageUrl: string;
        mimeType: string;
      }
    | undefined
  >,
});

const UploadPostGraphConfiguration = Annotation.Root({
  [POST_TO_LINKEDIN_ORGANIZATION]: Annotation<boolean | undefined>,
  /**
   * Whether or not to use text only mode throughout the graph.
   * If true, it will not try to extract, validate, or upload images.
   * Additionally, it will not be able to handle validating YouTube videos.
   * @default false
   */
  [TEXT_ONLY_MODE]: Annotation<boolean | undefined>({
    reducer: (_state, update) => update,
    default: () => false,
  }),
});

interface PostUploadFailureToSlackArgs {
  uploadDestination: "twitter" | "linkedin";
  error: any;
  threadId: string;
  postContent: string | ComplexPost;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function postUploadFailureToSlack({
  uploadDestination,
  error,
  threadId,
  postContent,
  image,
}: PostUploadFailureToSlackArgs) {
  if (!process.env.SLACK_CHANNEL_ID) {
    console.warn(
      "No SLACK_CHANNEL_ID found in environment variables. Can not send error message to Slack.",
    );
    return;
  }
  const slackClient = new SlackClient();

  const postStr =
    typeof postContent === "string"
      ? `Post:
\`\`\`
${postContent}
\`\`\``
      : `Main post:
\`\`\`
${postContent.main_post}
\`\`\`
Reply post:
\`\`\`
${postContent.reply_post}
\`\`\``;

  const slackMessageContent = `❌ FAILED TO UPLOAD POST TO ${uploadDestination.toUpperCase()} ❌

Error message:
\`\`\`
${error}
\`\`\`

Thread ID: *${threadId}*

${postStr}

${image ? `Image:\nURL: ${image.imageUrl}\nMIME type: ${image.mimeType}` : ""}
`;
  await slackClient.sendMessage(
    process.env.SLACK_CHANNEL_ID,
    slackMessageContent,
  );
}

export async function uploadPost(
  state: typeof UploadPostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof UploadPostAnnotation.State>> {
  if (!state.post) {
    throw new Error("No post text found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  try {
    let twitterClient: TwitterClient;

    if (useTwitterApiOnly() || !useArcadeAuth()) {
      twitterClient = TwitterClient.fromBasicTwitterAuth();
    } else {
      const twitterUserId = process.env.TWITTER_USER_ID;
      if (!twitterUserId) {
        throw new Error("Twitter user ID not found in configurable fields.");
      }

      const twitterToken = process.env.TWITTER_USER_TOKEN;
      const twitterTokenSecret = process.env.TWITTER_USER_TOKEN_SECRET;

      twitterClient = await TwitterClient.fromArcade(
        twitterUserId,
        {
          twitterToken,
          twitterTokenSecret,
        },
        {
          textOnlyMode: isTextOnlyMode,
        },
      );
    }

    let mediaBuffer: CreateMediaRequest | undefined = undefined;
    if (!isTextOnlyMode) {
      mediaBuffer = await getMediaFromImage(state.image);
    }

    let tweetId: string | undefined;

    if (state.complexPost) {
      const threadResponse = await twitterClient.uploadThread([
        {
          text: ensureSignature(state.complexPost.main_post),
          ...(mediaBuffer && { media: mediaBuffer }),
        },
        {
          text: state.complexPost.reply_post,
        },
      ]);
      tweetId = threadResponse[0]?.data?.id;
    } else {
      const tweetResponse = await twitterClient.uploadTweet({
        text: ensureSignature(state.post),
        ...(mediaBuffer && { media: mediaBuffer }),
      });
      tweetId = tweetResponse.data?.id;
    }

    console.log("✅ Successfully uploaded Tweet ✅");

    if (tweetId) {
      await retweetFromMainAccount(tweetId);
    }
  } catch (e: any) {
    console.error("Failed to upload post:", e);
    let errorString = "";
    if (typeof e === "object" && "message" in e) {
      errorString = e.message;
    } else {
      errorString = e;
    }
    await postUploadFailureToSlack({
      uploadDestination: "twitter",
      error: errorString,
      threadId:
        config.configurable?.thread_id || "no thread id found in configurable",
      postContent: state.complexPost || state.post,
      image: state.image,
    });
  }

  try {
    let linkedInClient: LinkedInClient;

    if (useArcadeAuth()) {
      const linkedInUserId = process.env.LINKEDIN_USER_ID;
      if (!linkedInUserId) {
        throw new Error("LinkedIn user ID not found in configurable fields.");
      }

      linkedInClient = await LinkedInClient.fromArcade(linkedInUserId, {
        postToOrganization: postToLinkedInOrg,
      });
    } else {
      const accessToken =
        process.env.LINKEDIN_ACCESS_TOKEN ||
        config.configurable?.[LINKEDIN_ACCESS_TOKEN];
      if (!accessToken) {
        throw new Error(
          "LinkedIn access token not found in environment or configurable fields. Either set it, or use Arcade Auth.",
        );
      }

      const personUrn =
        process.env.LINKEDIN_PERSON_URN ||
        config.configurable?.[LINKEDIN_PERSON_URN];
      const organizationId =
        process.env.LINKEDIN_ORGANIZATION_ID ||
        config.configurable?.[LINKEDIN_ORGANIZATION_ID];
      linkedInClient = new LinkedInClient({
        accessToken: accessToken,
        personUrn: personUrn,
        organizationId: organizationId,
      });
    }

    let linkedInPostUrn: string | undefined;

    if (!isTextOnlyMode && state.image) {
      const response = await linkedInClient.createImagePost(
        {
          text: ensureSignature(state.post),
          imageUrl: state.image.imageUrl,
        },
        {
          postToOrganization: postToLinkedInOrg,
        },
      );
      if (response && typeof response === "object" && "id" in response) {
        linkedInPostUrn = (response as { id: string }).id;
      }
    } else {
      const response = await linkedInClient.createTextPost(
        ensureSignature(state.post),
        {
          postToOrganization: postToLinkedInOrg,
        },
      );
      if (response && typeof response === "object" && "id" in response) {
        linkedInPostUrn = (response as { id: string }).id;
      }
    }

    console.log("✅ Successfully uploaded post to LinkedIn ✅");

    if (linkedInPostUrn) {
      await reshareFromMainLinkedInAccount(linkedInPostUrn);
    }
  } catch (e: any) {
    console.error("Failed to upload post:", e);
    let errorString = "";
    if (typeof e === "object" && "message" in e) {
      errorString = e.message;
    } else {
      errorString = e;
    }
    await postUploadFailureToSlack({
      uploadDestination: "linkedin",
      error: errorString,
      threadId:
        config.configurable?.thread_id || "no thread id found in configurable",
      postContent: state.complexPost || state.post,
      image: state.image,
    });
  }

  return {};
}

const uploadPostWorkflow = new StateGraph(
  UploadPostAnnotation,
  UploadPostGraphConfiguration,
)
  .addNode("uploadPost", uploadPost)
  .addEdge(START, "uploadPost")
  .addEdge("uploadPost", END);

export const uploadPostGraph = uploadPostWorkflow.compile();
uploadPostGraph.name = "Upload Post Graph";
