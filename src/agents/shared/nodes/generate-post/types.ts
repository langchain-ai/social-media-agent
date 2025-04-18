import { Annotation } from "@langchain/langgraph";
import { DateType } from "../../../types.js";
import { IngestDataAnnotation } from "../../../ingest-data/ingest-data-state.js";
import { VerifyLinksResultAnnotation } from "../../../verify-links/verify-links-state.js";

export type ComplexPost = {
  /**
   * The main post content.
   */
  main_post: string;
  /**
   * The reply post content.
   */
  reply_post: string;
};

const BaseGeneratePostAnnotation = Annotation.Root({
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
   * The node to execute next.
   */
  next: Annotation<string | undefined>,
  /**
   * Response from the user for the post. Typically used to request
   * changes to be made to the post.
   */
  userResponse: Annotation<string | undefined>,
});

export type BaseGeneratePostState = typeof BaseGeneratePostAnnotation.State;
export type BaseGeneratePostUpdate = typeof BaseGeneratePostAnnotation.Update;
