import { Annotation } from "@langchain/langgraph";
import { SimpleSlackMessage } from "../../clients/slack.js";
import {
  LLM_MODEL_NAME,
  POST_TO_LINKEDIN_ORGANIZATION,
} from "../generate-post/constants.js";

export type LangChainProduct = "langchain" | "langgraph" | "langsmith";
export type SimpleSlackMessageWithLinks = SimpleSlackMessage & {
  links: string[];
};

export const IngestDataAnnotation = Annotation.Root({
  /**
   * The links to content to use for generating posts.
   */
  links: Annotation<string[]>,
  /**
   * A report generated on the content. Will be used in the main
   * graph when generating the post about this content.
   */
  report: Annotation<string>,
  /**
   * The content of the linkedin post.
   */
  linkedinPost: Annotation<string>,
  /**
   * The content of the tweet.
   */
  twitterPost: Annotation<string>,
});

export const IngestDataConfigurableAnnotation = Annotation.Root({
  maxMessages: Annotation<number>({
    reducer: (_state, update) => update,
    default: () => 100,
  }),
  /**
   * The maximum number of days to go back when ingesting
   * messages from Slack.
   */
  maxDaysHistory: Annotation<number>,
  slackChannelName: Annotation<string | undefined>,
  slackChannelId: Annotation<string | undefined>,
  /**
   * Whether or not to skip ingesting messages from Slack.
   * This will throw an error if slack messages are not
   * pre-provided in state.
   */
  skipIngest: Annotation<boolean | undefined>,
  /**
   * Whether to post to the LinkedIn organization or the user's profile.
   * If true, [LINKEDIN_ORGANIZATION_ID] is required.
   */
  [POST_TO_LINKEDIN_ORGANIZATION]: Annotation<boolean | undefined>,
  /**
   * The name of the LLM to use for generations
   * @default "gemini-2.0-flash-exp"
   */
  [LLM_MODEL_NAME]: Annotation<
    "gemini-2.0-flash-exp" | "claude-3-5-sonnet-latest" | undefined
  >({
    reducer: (_state, update) => update,
    default: () => "gemini-2.0-flash-exp",
  }),
});
