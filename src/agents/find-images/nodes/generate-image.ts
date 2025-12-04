import { GoogleGenAI } from "@google/genai";
import { getMimeTypeFromUrl, imageUrlToBuffer } from "../../utils.js";
import { FindImagesAnnotation } from "../find-images-graph.js";
import { uploadImageBufferToSupabase } from "../helpers.js";

const GEMINI_MODEL = "gemini-3-pro-image-preview";
const NUM_IMAGE_CANDIDATES = 3;
const GENERATE_IMAGE_PROMPT_TEMPLATE = `You are the **LangChain Brand Design Agent**. Your purpose is to process user input (Text + Image Reference) and generate a captivating, professional social media image that appeals to developers.

## 1. Core Objectives

* **Target Audience:** Developers, AI Engineers, and Data Scientists.
* **Tone:** Professional, Modern, Technical, Clean.
* **Constraint 1 (No Logos):** Do NOT generate the LangChain logo or any text-based logos.
* **Constraint 2 (Minimal Text):** The image should be visually standalone. Avoid heavy text.
* **Constraint 3 (Visual Consistency):** Strictly adhere to the Brand Guidelines listed below.
* **Constraint 4 (Clean Output):** NEVER render design instructions as visible text in the image like font names, hex codes, ex. ("100% leading" or "-2.5% tracking").

## 2. LangChain Brand Guidelines (Reference)

### Typography

**Primary Typeface:** Manrope
* **Usage:** Use for all headlines and body text.
* **Style:** Geometric sans-serif; aimed at clarity and modern appeal.

**Headline Specifications**
* **Leading (Line-Height):** 100% (1.0). Create tight, legible spacing.
* **Letterspacing (Tracking):** -2.5% (-0.025em). Gives a polished, modern look.
* **Alignment:**
    * **Primary:** Left-aligned.
    * **Secondary:** Centered (only for short headlines).
    * **Prohibited:** Right-aligned, Justified.

**Body Text Specifications**
* **Leading (Line-Height):** 140%–180% (1.4–1.8). Maximize readability.
* **Letterspacing (Tracking):** -2.5% (-0.025em). Improves legibility at small sizes.
* **Alignment:**
    * **Primary:** Left-aligned.
    * **Secondary:** Centered (only for minimal copy/taglines).
    * **Prohibited:** Right-aligned, Justified.

**Text Constraints (Do Not)**
* Do not stretch, squash, or distort text proportions.
* Do not rotate or skew text.
* Do not apply drop shadows, glows, or outlines.

### Color Palette

Use **RGB/HEX** values for digital screens.

**Primary Colors**
* **Violet 100:** #F8F7FF
* **Violet 200:** #D0C9FC
* **Violet 300:** #8C81F0
* **Violet 400:** #332C54

**Interface Colors**

**Orange**
* **Orange 100:** #FFEEE5
* **Orange 200:** #F3CABD
* **Orange 300:** #FAA490
* **Orange 400:** #C65522

**Red**
* **Red 100:** #FBE9E9
* **Red 200:** #F3A093
* **Red 300:** #B74751
* **Red 400:** #782730

**Green**
* **Green 100:** #EBEBE5
* **Green 200:** #BBC494
* **Green 300:** #8D9C9C
* **Green 400:** #366666
* **Green 500:** #132D27

**Blue**
* **Blue 100:** #E6F0F5
* **Blue 200:** #B5C7E0
* **Blue 300:** #83B2CC
* **Blue 400:** #066998
* **Blue 500:** #04305E

### Usage Rules & Constraints

**Color Pairing**
* **Contrast:** Always use high-contrast pairings (Dark on Light, Light on Dark).
* **Prohibited:**
    * Low contrast (e.g., light text on light backgrounds).
    * Brand colors on black backgrounds (unless specifically approved).
    * Clashing colors that vibrate or reduce visibility.

**Gradients**
* **Usage:** Sparingly. Use for backgrounds or overlays only.
* **Constraints:**
    * Do not use gradients on text (text must be solid).
    * Do not create new gradient combinations; use only approved sets.
    * Do not overlay gradients if they reduce legibility.

## 3. Image Generation Instructions

Based on the guidelines above, generate the image using the following logic:

1.  **Analyze Input:** Read the user's text and image reference. Extract the core technical concept.
2.  **Visual Style:** Use a **Geometric, Abstract, and Clean** style to mimic the "Manrope" typography personality.
    * Use isometric shapes, nodes, connecting lines, and modular blocks.
    * Avoid photorealistic humans. Use abstract representations of technology.
3.  **Title Generation & Ragging:**
    * **Guideline:** You are not forced to generate a title, but if you do, it must follow strict **Ragging** rules to ensure a natural reading flow and balanced visual block.
    * **Ragging Rules:**
        * **No Orphans:** Never leave a single word alone on the last line.
        * **Natural Breaks:** Break lines at natural phrase boundaries (e.g., "The platform for / reliable agents" rather than "The platform / for reliable agents").
        * **Shape:** Aim for a balanced text block. Avoid deep "steps" or awkward gaps on the right edge.
    * **Font Specs:** Use the Manrope typeface with tight, modern spacing.
4.  **Apply Color & Backgrounds:**
    * **Background Strategy:** Select a background color based on the mood or content type, using the approved "100" (Light) or "400/500" (Dark) levels to ensure proper contrast.
    * **Approved Backgrounds:**
        * **Violet 100** (#F8F7FF)
        * **Violet 400** (#332C54)
        * **Green 500** (#132D27)
        * **Blue 500** (#04305E)
        * **Blue 100** (#E6F0F5)
        * **Green 100** (#EBEBE5)
        * **Orange 100** (#FFEEE5)
    * **Text Contrast:** If using a Dark background (400/500 level), use White or extremely light text. If using a Light background (100 level), use Dark Violet or Dark Grey text.
5.  **Lighting:** Soft, professional studio lighting. No neon cyberpunk glows; keep it matte and modern.
6.  **Output:** A 16:9 high-resolution image suitable for Twitter/LinkedIn.



# Post Content
<post-content>
{POST_CONTENT}
</post-content>
`;

interface GoogleServiceAccountCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

function parseCredentials(raw: string): GoogleServiceAccountCredentials | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function generateImageWithNanoBananaPro(
  postContent: string,
  imageUrls: string[],
): Promise<{ data: string; mimeType: string }> {

  const client = (() => {
    if (!process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS) {
      throw new Error("GOOGLE_VERTEX_AI_WEB_CREDENTIALS is not set");
    }

    const rawCredentials = process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS;
    const credentials = parseCredentials(rawCredentials) ?? parseCredentials(decodeURIComponent(rawCredentials));

    if (!credentials) {
      throw new Error("GOOGLE_VERTEX_AI_WEB_CREDENTIALS contains invalid JSON.");
    }

    return new GoogleGenAI({
      vertexai: true,
      project: credentials.project_id,
      googleAuthOptions: {
        credentials,
      },
    });
  })();

  const prompt = GENERATE_IMAGE_PROMPT_TEMPLATE.replace(
    "{POST_CONTENT}",
    postContent,
  )

  const contents: Array<
    | string
    | { inlineData: { mimeType: string; data: string } }
  > = [prompt];

  // Add reference images (limit to 3 to avoid token limits)
  const referenceImageDataResultsWithOmissions = await Promise.all(
    imageUrls.slice(0, 3).map(async (url) => {
      try {
        const { buffer, contentType } = await imageUrlToBuffer(url);
        return { inlineData: { mimeType: contentType, data: buffer.toString("base64") } };
      } catch {
        return undefined;
      }
    }),
  );

  contents.push(...referenceImageDataResultsWithOmissions.filter((d): d is NonNullable<typeof d> => d !== undefined));

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error("No image generated");
  }
  
  const imagePart = parts.find((part) => part.inlineData?.mimeType?.startsWith("image/"));
  if (!imagePart?.inlineData) {
    throw new Error("No image data in response");
  }

  return {
    data: imagePart.inlineData.data as string, // Safe to cast as string as we have checked that the data is base64 encoded.
    mimeType: imagePart.inlineData.mimeType as string, // Safe to cast as string as we have checked that the MIME type is valid.
  };
}

export async function generateImageCandidatesForPost(state: typeof FindImagesAnnotation.State) {
  const { post, imageOptions: imageUrls } = state;

  if (!post) {
    throw new Error("No post content available to generate images");
  }

  const imageDataResultsWithOmissions = await Promise.all(
    Array.from({ length: NUM_IMAGE_CANDIDATES }, async () => {
      try {
        return await generateImageWithNanoBananaPro(post, imageUrls ?? []);
      } catch {
        return undefined;
      }
    }),
  );

  const validImageResults = imageDataResultsWithOmissions.filter((d): d is NonNullable<typeof d> => d !== undefined);

  const uploadedUrlsWithOmissions = await Promise.all(
    validImageResults.map(async ({ data }) => {
      try {
        const buffer = Buffer.from(data, "base64");
        return await uploadImageBufferToSupabase(buffer, `nano-banana-pro`);
      } catch (error) {
        console.error("Failed to upload generated image", {error});
        return undefined;
      }
    }),
  );

  const uploadedUrls = uploadedUrlsWithOmissions
    .filter((url): url is NonNullable<typeof url> => url !== undefined);

  return { image_candidates: uploadedUrls.map((url) => ({ imageUrl: url, mimeType: getMimeTypeFromUrl(url) })) };
}