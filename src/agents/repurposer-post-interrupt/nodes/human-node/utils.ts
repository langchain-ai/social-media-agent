import { RepurposerPostInterruptState } from "../../types.js";

export function getUnknownResponseDescription(
  state: RepurposerPostInterruptState,
) {
  if (state.next === "unknownResponse" && state.userResponse) {
    return `# <div style="color: red;">UNKNOWN/INVALID RESPONSE RECEIVED: '${state.userResponse}'</div>

<div style="color: red;">Please respond with either request to rewrite the post(s). Other responses are <strong>not supported</strong>.</div>

<div style="color: red;">See the \`Instructions\` sections for more information.</div>

<hr />`;
  }
  return "";
}

function formatImageDescriptions(imageOptions: string[]): {
  imageOptionsText: string;
  imageInstructionsString: string;
} {
  const imageOptionsText = imageOptions?.length
    ? `## Image Options
    
The following image options are available. Select one by copying and pasting the URL into the 'New Images' field, separated by double commas (e.g \`example.com,,other-example.com\`).
    
${imageOptions
  .map(
    (url, index) => `${index === 0 ? "**[DEFAULT]** " : ""}URL: ${url}
Image: <details><summary>Click to view image</summary>

![](${url})
</details>
`,
  )
  .join("\n")}`
    : "";

  const imageInstructionsString = imageOptions?.length
    ? `If you wish to attach an image to the post, please add a public image URL.

You may remove the image by setting the 'image' field to 'remove', or by removing all text from the field
To replace the image, simply add a new public image URL to the field.

MIME types will be automatically extracted from the image.
Supported image types: \`image/jpeg\` | \`image/gif\` | \`image/png\` | \`image/webp\``
    : "No image options available.";

  return {
    imageOptionsText,
    imageInstructionsString,
  };
}

export function constructDescription({
  state,
  unknownResponseDescription,
}: {
  state: RepurposerPostInterruptState;
  unknownResponseDescription: string;
}): string {
  const {
    originalLink,
    originalContent,
    contextLinks,
    additionalContexts,
    reports,
    imageOptions,
    posts,
    post,
  } = state;

  const unknownResponseString = unknownResponseDescription
    ? `${unknownResponseDescription}\n\n`
    : "";

  const { imageOptionsText, imageInstructionsString } =
    formatImageDescriptions(imageOptions);

  return `${unknownResponseString}# Schedule Repurposed Post

## Post

${post}

## All Generated Posts (for reference)

${posts.map((p) => `### Post ${p.index + 1}:\n\`\`\`${p.content}\n\`\`\``).join("\n\n")}

## Original Link

${originalLink}

<details><summary>Original Link Contents</summary>

\`\`\`
${originalContent}
\`\`\`

</details>
  
## Additional Contexts

${contextLinks?.length ? `- ${contextLinks.join("\n- ")}` : "No additional context available."}

${
  additionalContexts?.length
    ? `<details><summary>Additional Contexts Contents</summary>

${additionalContexts.map(
  (c, idx) => `<details><summary>${idx + 1} - ${c.link}</summary>

\`\`\`
${c.content}
\`\`\`

</details>
`,
)}

</details>`
    : ""
}

${imageOptionsText}

## Instructions

There are a few different actions which can be taken:\n
- **Edit**: If the post is edited and submitted, it will be scheduled for Twitter/LinkedIn.
- **Response**: If a response is sent, it will be sent to a router which can be routed to either
  1. A node which will be used to rewrite the post. Please note, the response will be used as the 'user' message in an LLM call to rewrite the post, so ensure your response is properly formatted.
  2. A node which will be used to update the scheduled date for the post.
  If an unknown/invalid response is sent, nothing will happen, and it will be routed back to the human node.
- **Accept**: If 'accept' is selected, the post will be scheduled for Twitter/LinkedIn.
- **Ignore**: If 'ignore' is selected, this post will not be scheduled, and the thread will end.

## Additional Instructions

### Schedule Date

The date the post will be scheduled for may be edited, but it must follow the format 'MM/dd/yyyy hh:mm a z'. Example: '12/25/2024 10:00 AM PST', _OR_ you can use a priority level:
- **R1**: TODO: WHAT SCHEDULE DATE FOR R1
- **R2**: TODO: WHAT SCHEDULE DATE FOR R2
- **R3**: TODO: WHAT SCHEDULE DATE FOR R3

### Image

${imageInstructionsString}

## Report

Here is the report that was generated for the posts

<details><summary>Expand Report</summary>

#### Key Details

${reports[0].keyDetails}

<hr/>

${reports[0].report}
</details>
`;
}
