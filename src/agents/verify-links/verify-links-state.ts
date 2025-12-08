import { Annotation } from "@langchain/langgraph";
import { filterUnwantedImageUrls } from "../utils.js";
import { SKIP_CONTENT_RELEVANCY_CHECK } from "../generate-post/constants.js";

export const VerifyLinksGraphSharedAnnotation = Annotation.Root({
  /**
   * The links to verify.
   */
  links: Annotation<string[]>,
});

const sharedLinksReducer = (
  state: string[] | undefined,
  update: string[] | undefined,
) => {
  if (update === undefined) return undefined;
  // Use a set to ensure no duplicate links are added.
  // Start with update items first to preserve their order at the front
  const resultSet = new Set<string>();
  update.filter((u): u is string => !!u).forEach((link) => resultSet.add(link));
  // Then add any remaining state items that weren't in the update
  (state || []).forEach((link) => resultSet.add(link));
  return filterUnwantedImageUrls(Array.from(resultSet));
};

export const VerifyLinksResultAnnotation = Annotation.Root({
  /**
   * Page content used in the verification nodes. Will be used in the report
   * generation node.
   */
  pageContents: Annotation<string[] | undefined>({
    reducer: (state, update) => {
      if (update === undefined) return undefined;
      return (state || []).concat(update);
    },
    default: () => [],
  }),
  /**
   * Relevant links found in the message.
   */
  relevantLinks: Annotation<string[] | undefined>({
    reducer: sharedLinksReducer,
    default: () => [],
  }),
  /**
   * Image options to provide to the user.
   */
  imageOptions: Annotation<string[] | undefined>({
    reducer: sharedLinksReducer,
    default: () => [],
  }),
});

export const VerifyLinksGraphAnnotation = Annotation.Root({
  /**
   * The links to verify.
   */
  links: VerifyLinksGraphSharedAnnotation.spec.links,
  ...VerifyLinksResultAnnotation.spec,
});

export const VerifyLinksGraphConfigurableAnnotation = Annotation.Root({
  /**
   * Whether or not to skip the content relevancy check.
   */
  [SKIP_CONTENT_RELEVANCY_CHECK]: Annotation<boolean | undefined>(),
});
