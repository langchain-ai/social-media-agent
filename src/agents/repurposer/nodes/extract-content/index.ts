import { RepurposerState } from "../../types.js";
import { getUrlContents } from "./get-url-contents.js";

export async function extractContent(
  state: RepurposerState,
): Promise<Partial<RepurposerState>> {
  const { contents: originalContent, imageUrls } = await getUrlContents(
    state.originalLink,
  );
  const originalContentPrompt = `Here is the original content. This content is the basis of the new marketing campaign. This post has already been shared, so use this as a base for the new campaign building ontop of this post:
  
<original-post-content>
${originalContent}
</original-post-content>`;

  if (!state.contextLinks?.length) {
    return {
      pageContents: [originalContentPrompt],
      imageOptions: imageUrls,
      originalContent,
    };
  }

  const additionalContextPromises = state.contextLinks.map(async (link) => {
    const { contents, imageUrls } = await getUrlContents(link);
    return {
      content: contents,
      link,
      imageUrls,
    };
  });
  const additionalContexts = await Promise.all(additionalContextPromises);

  const masterPageContent = `${originalContentPrompt}

Here is additional related context you should use in the new marketing campaign. This context has not been released yet, so use this as the new context for this marketing campaign:
<additional-contexts>
${additionalContexts
  .map(
    ({ content, link }, index) => `<context link="${link}" index="${index}">
${content}
</context>`,
  )
  .join("\n")}
</additional-contexts>`;

  return {
    pageContents: [masterPageContent],
    imageOptions: [
      ...imageUrls,
      ...additionalContexts.flatMap((c) => c.imageUrls || []),
    ],
    originalContent,
    additionalContexts: additionalContexts.map((c) => ({
      content: c.content,
      link: c.link,
    })),
  };
}
