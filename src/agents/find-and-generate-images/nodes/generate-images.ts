import { GoogleGenAI, Part } from "@google/genai";
import {
  getMimeTypeFromUrl,
  imageUrlToBuffer,
  retryWithTimeout,
  sleep,
} from "../../utils.js";
import { FindAndGenerateImagesAnnotation } from "../find-and-generate-images-graph.js";
import { uploadImageBufferToSupabase } from "../helpers.js";

const GEMINI_MODEL = "gemini-3-pro-image-preview";

const GENERATE_IMAGE_PROMPT_TEMPLATE = {
  role: "LangChain Brand Design Agent",
  purpose:
    "Process user input (Text + Image Reference) and generate a captivating, professional social media image that appeals to developers.",
  core_design_principles: {
    target_audience: ["Developers", "AI Engineers", "Data Scientists"],
    tone: ["Professional", "Modern", "Technical", "Clean"],
    constraints: {
      no_logos:
        "Do NOT generate the LangChain logo (a parrot) or any text-based logos. NEVER render a parrot in any form.",
      minimal_text: "The image should be visually standalone. Avoid heavy text.",
      visual_consistency: "Strictly adhere to the Brand Guidelines.",
      clean_output:
        "NEVER render design instructions as visible text in the image.",
      no_design_metadata_in_image: {
        description:
          "ABSOLUTELY DO NOT include ANY of the following as visible text or elements in the generated image:",
        forbidden_elements: [
          "Font names (e.g., Manrope, Arial, Helvetica)",
          "Color names or hex codes (e.g., #F8F7FF, Violet 100, Blue 500)",
          "Design specifications (e.g., 100% leading, -2.5% tracking, 16:9)",
          "Typography instructions or measurements",
          "Any technical design guidelines or parameters",
          "Made by LangChain Community or similar attribution text",
        ],
        note: "These details are for YOUR reference only - they must NEVER appear in the final image.",
      },
    },
  },
  brand_guidelines: {
    typography: {
      primary_typeface: "Manrope",
      style: "Geometric sans-serif; aimed at clarity and modern appeal",
      headline: {
        leading: "100% (1.0) - tight, legible spacing",
        tracking: "-2.5% (-0.025em) - polished, modern look",
        alignment: {
          primary: "Left-aligned",
          secondary: "Centered (only for short headlines)",
          prohibited: ["Right-aligned", "Justified"],
        },
      },
      body_text: {
        leading: "140%-180% (1.4-1.8) - maximize readability",
        tracking: "-2.5% (-0.025em) - improves legibility at small sizes",
        alignment: {
          primary: "Left-aligned",
          secondary: "Centered (only for minimal copy/taglines)",
          prohibited: ["Right-aligned", "Justified"],
        },
      },
      text_constraints: [
        "Do not stretch, squash, or distort text proportions",
        "Do not rotate or skew text",
        "Do not apply drop shadows, glows, or outlines",
      ],
    },
    color_palette: {
      primary: {
        violet_100: "#F8F7FF",
        violet_200: "#D0C9FC",
        violet_300: "#8C81F0",
        violet_400: "#332C54",
      },
      interface: {
        orange: {
          "100": "#FFEEE5",
          "200": "#F3CABD",
          "300": "#FAA490",
          "400": "#C65522",
        },
        red: {
          "100": "#FBE9E9",
          "200": "#F3A093",
          "300": "#B74751",
          "400": "#782730",
        },
        green: {
          "100": "#EBEBE5",
          "200": "#BBC494",
          "300": "#8D9C9C",
          "400": "#366666",
          "500": "#132D27",
        },
        blue: {
          "100": "#E6F0F5",
          "200": "#B5C7E0",
          "300": "#83B2CC",
          "400": "#066998",
          "500": "#04305E",
        },
      },
    },
    usage_rules: {
      color_pairing: {
        contrast: "Always use high-contrast pairings (Dark on Light, Light on Dark)",
        prohibited: [
          "Low contrast (e.g., light text on light backgrounds)",
          "Brand colors on black backgrounds (unless specifically approved)",
          "Clashing colors that vibrate or reduce visibility",
        ],
      },
      gradients: {
        usage: "Sparingly. Use for backgrounds or overlays only.",
        constraints: [
          "Do not use gradients on text (text must be solid)",
          "Do not create new gradient combinations; use only approved sets",
          "Do not overlay gradients if they reduce legibility",
        ],
      },
    },
  },
  image_generation_instructions: {
    step_1_analyze_input:
      "Read the user's text and image reference. Extract the core technical concept.",
    step_2_visual_style: {
      base_style: "Geometric, Abstract, and Clean",
      architecture_diagram_aesthetic:
        "Lean toward visuals that resemble system architecture diagrams, flowcharts, or technical schematics - think data pipelines, agent workflows, or component relationships.",
      visual_elements: [
        "Isometric shapes",
        "Nodes",
        "Connecting lines",
        "Directional arrows",
        "Modular blocks",
      ],
      creative_freedom:
        "Feel free to interpret creatively - the diagram style is a guiding direction, not a strict constraint.",
      avoid: "Photorealistic humans. Use abstract representations of technology.",
    },
    step_3_title_generation: {
      guideline:
        "You are not forced to generate a title, but if you do, follow strict Ragging rules.",
      ragging_rules: {
        no_orphans: "Never leave a single word alone on the last line",
        natural_breaks:
          "Break lines at natural phrase boundaries (e.g., 'The platform for / reliable agents' rather than 'The platform / for reliable agents')",
        shape: "Aim for a balanced text block. Avoid deep steps or awkward gaps on the right edge",
      },
      font_specs: "Use the Manrope typeface with tight, modern spacing",
    },
    step_4_colors_and_backgrounds: {
      strategy:
        "Select a background color based on the mood or content type, using approved 100 (Light) or 400/500 (Dark) levels.",
      approved_backgrounds: [
        { name: "Violet 100", hex: "#F8F7FF" },
        { name: "Violet 400", hex: "#332C54" },
        { name: "Green 500", hex: "#132D27" },
        { name: "Blue 500", hex: "#04305E" },
        { name: "Blue 100", hex: "#E6F0F5" },
        { name: "Green 100", hex: "#EBEBE5" },
        { name: "Orange 100", hex: "#FFEEE5" },
      ],
      text_contrast:
        "Dark background (400/500): use White or extremely light text. Light background (100): use Dark Violet or Dark Grey text.",
    },
    step_5_lighting:
      "Soft, professional studio lighting. No neon cyberpunk glows; keep it matte and modern.",
    step_6_output: "A 16:9 high-resolution image suitable for Twitter/LinkedIn.",
  },
  final_reflection: {
    description:
      "CRITICAL: Before finalizing the image, perform this mandatory self-check.",
    verify_image_does_not_contain: [
      "Any font names (Manrope, etc.)",
      "Any hex codes (#F8F7FF, #332C54, etc.)",
      "Any color names as text (Violet 100, Blue 500, Green 400, etc.)",
      "Any design specifications (100% leading, -2.5% tracking, 16:9, etc.)",
      "Any typography instructions or measurements",
      "Any design metadata that was meant for internal reference only",
      "Made by LangChain Community or similar attribution text",
      "Any parrot imagery (the LangChain logo is a parrot - it must NEVER appear)",
    ],
    action:
      "If ANY of the above appear as visible text in the image, you MUST regenerate the image without them.",
  },
  input: {
    style_variation: "{STYLE_VARIATION}",
    post_content: "{POST_CONTENT}",
  },
};

const STYLE_VARIATIONS = [
  `Violet 100 (#F8F7FF) background. Accent with Orange 300, Orange 400, and Red 300.`,
  `Violet 400 (#332C54) background. Accent with Violet 200, Blue 300, and Green 300.`,
  `Blue 100 (#E6F0F5) background. Accent with Blue 400, Green 400, and Violet 300.`,
  `Blue 500 (#04305E) background. Accent with Blue 200, Violet 200, and Orange 200.`,
  `Green 100 (#EBEBE5) background. Accent with Green 400, Orange 300, and Blue 400.`,
  `Green 500 (#132D27) background. Accent with Green 200, Blue 300, and Violet 300.`,
];


const getPromptString = (styleVariation: string, postContent: string): string => {
  const promptWithInput = {
    ...GENERATE_IMAGE_PROMPT_TEMPLATE,
    input: {
      style_variation: styleVariation,
      post_content: postContent,
    },
  };
  return JSON.stringify(promptWithInput, null, 2);
};

export async function generateImageWithNanoBananaPro(
  postContent: string,
  imageUrls: string[],
  variationIndex: number = 0,
): Promise<{ data: string; mimeType: string }> {
  const client = (() => {
    if (!process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS) {
      throw new Error("GOOGLE_VERTEX_AI_WEB_CREDENTIALS is not set");
    }

    const credentials = JSON.parse(
      process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS,
    );

    return new GoogleGenAI({
      vertexai: true,
      project: credentials.project_id,
      googleAuthOptions: {
        credentials,
      },
    });
  })();

  const styleVariation =
    STYLE_VARIATIONS[variationIndex % STYLE_VARIATIONS.length];

  const prompt = getPromptString(styleVariation, postContent);

  const contents: (string | Part)[] = [prompt];

  // Add reference images (limit to 3 to avoid token limits)
  const referenceImagesWithOmissions = await Promise.all(
    imageUrls.slice(0, 3).map(async (url) => {
      try {
        const { buffer, contentType } = await imageUrlToBuffer(url);

        if (!contentType.startsWith("image/")) {
          console.warn("Skipping non-image content type", { url, contentType });
          return undefined;
        }

        return {
          inlineData: {
            mimeType: contentType,
            data: buffer.toString("base64"),
          },
        };
      } catch (error) {
        console.warn("Failed to load reference image", { url, error });
        return undefined;
      }
    }),
  );

  const validReferenceImages = referenceImagesWithOmissions.filter(
    (d): d is NonNullable<typeof d> => d !== undefined,
  );

  if (validReferenceImages.length > 0) {
    contents.push(...validReferenceImages);
  }

  const generate = (contentsToUse: typeof contents) =>
    client.models.generateContent({
      model: GEMINI_MODEL,
      contents: contentsToUse,
      config: {
        temperature: 1.2 + Math.random() * 0.6,
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "16:9" },
      },
    });

  const retryOpts = { maxRetries: 3, baseDelayMs: 3000, timeoutMs: 120_000 };

  const response = await retryWithTimeout(
    () => generate(contents),
    retryOpts,
  ).catch(async (error) => {
    const msg = error instanceof Error ? error.message : String(error);
    const isImageError =
      msg.includes("image is not valid") || msg.includes("INVALID_ARGUMENT");

    if (contents.length > 1 && isImageError) {
      console.warn("Reference images rejected, retrying text-only");
      return retryWithTimeout(() => generate([prompt]), retryOpts);
    }

    throw error;
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error("No image generated");
  }

  const imagePart = parts.find((part) =>
    part.inlineData?.mimeType?.startsWith("image/"),
  );
  if (!imagePart?.inlineData) {
    throw new Error("No image data in response");
  }

  return {
    data: imagePart.inlineData.data as string, // Safe to cast as string as we have checked that the data is base64 encoded.
    mimeType: imagePart.inlineData.mimeType as string, // Safe to cast as string as we have checked that the MIME type is valid.
  };
}

export async function generateImageCandidatesForPost(
  state: typeof FindAndGenerateImagesAnnotation.State,
) {
  const {
    post,
    imageOptions: imageUrls,
    image_candidates: existingCandidates,
  } = state;

  if (!post) {
    throw new Error("No post content available to generate images");
  }

  const imageResults: { data: string; mimeType: string }[] = [];

  for (let index = 0; index < STYLE_VARIATIONS.length; index++) {
    try {
      const result = await generateImageWithNanoBananaPro(
        post,
        imageUrls ?? [],
        index,
      );
      imageResults.push(result);
    } catch (error) {
      console.error("Failed to generate image", { error, index });
    }

    await sleep(500);
  }

  const uploadedUrlsWithOmissions = await Promise.all(
    imageResults.map(async ({ data }) => {
      try {
        const buffer = Buffer.from(data, "base64");
        return await uploadImageBufferToSupabase(buffer, `nano-banana-pro`);
      } catch (error) {
        console.error("Failed to upload generated image", { error });
        return undefined;
      }
    }),
  );

  const uploadedUrls = uploadedUrlsWithOmissions.filter(
    (url): url is NonNullable<typeof url> => url !== undefined,
  );

  const generatedImages = uploadedUrls.map((url) => ({
    imageUrl: url,
    mimeType: getMimeTypeFromUrl(url),
  }));

  const existingCandidatesArray = Array.isArray(existingCandidates)
    ? existingCandidates
    : [];
  const imageUrlsArray = Array.isArray(imageUrls) ? imageUrls : [];

  const firstGeneratedImage = generatedImages[0];

  return {
    imageOptions: [...uploadedUrls, ...imageUrlsArray],
    image_candidates: [...generatedImages, ...existingCandidatesArray],
    image: firstGeneratedImage,
  };
}
