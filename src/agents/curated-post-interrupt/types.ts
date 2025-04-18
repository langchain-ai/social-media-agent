import { Annotation, END } from "@langchain/langgraph";
import { IngestDataAnnotation } from "../ingest-data/ingest-data-state.js";
import { DateType } from "../types.js";
import { VerifyLinksResultAnnotation } from "../verify-links/verify-links-state.js";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../generate-post/constants.js";
import { ComplexPost } from "../shared/nodes/generate-post/types.js";

export const CuratedPostInterruptAnnotation = Annotation.Root({
  /**
   * The links to use to generate a post.
   */
  links: Annotation<string[]>,
  /**
   * The report generated on the content of the message. Used
   * as context for generating the post.
   */
  report: IngestDataAnnotation.spec.report,
  ...VerifyLinksResultAnnotation.spec,
  /**
   * The generated post for LinkedIn/Twitter.
   */
  post: Annotation<string>,
  /**
   * The complex post, if the user decides to split the URL from the main body.
   *
   * TODO: Refactor the post/complexPost state interfaces to use a single shared interface
   * which includes images too.
   * Tracking issue: https://github.com/langchain-ai/social-media-agent/issues/144
   */
  complexPost: Annotation<ComplexPost | undefined>,
  /**
   * The date to schedule the post for.
   */
  scheduleDate: Annotation<DateType>,
  /**
   * Response from the user for the post. Typically used to request
   * changes to be made to the post.
   */
  userResponse: Annotation<string | undefined>,
  /**
   * The node to execute next.
   */
  next: Annotation<
    | "schedulePost"
    | "rewritePost"
    | "unknownResponse"
    | "updateScheduleDate"
    | typeof END
    | undefined
  >,
  /**
   * The image to attach to the post, and the MIME type.
   */
  image: Annotation<
    | {
        imageUrl: string;
        mimeType: string;
      }
    | undefined
  >,
  /**
   * The number of times the post has been condensed. We should stop condensing after
   * 3 times to prevent an infinite loop.
   */
  condenseCount: Annotation<number>({
    reducer: (_state, update) => update,
    default: () => 0,
  }),
});

export type CuratedPostInterruptState =
  typeof CuratedPostInterruptAnnotation.State;
export type CuratedPostInterruptUpdate =
  typeof CuratedPostInterruptAnnotation.Update;

export const CuratedPostInterruptConfigurableAnnotation = Annotation.Root({
  /**
   * Whether to post to the LinkedIn organization or the user's profile.
   * If true, [LINKEDIN_ORGANIZATION_ID] is required.
   */
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
