import { GoogleGenAI, Part } from "@google/genai";
import {
  getMimeTypeFromUrl,
  imageUrlToBuffer,
  retryWithTimeout,
  sleep,
} from "../../utils.js";
import { FindAndGenerateImagesAnnotation } from "../find-and-generate-images-graph.js";
import { embedImageInTemplate, uploadImageBufferToSupabase } from "../helpers.js";

const GEMINI_MODEL = "gemini-3-pro-image-preview";

const GENERATE_IMAGE_PROMPT_TEMPLATE = {
  role: "LangChain Brand Design Agent",
  purpose:
    "Process user input (Text + Image Reference) and generate a captivating, professional social media image that appeals to developers.",
  core_design_principles: {
    target_audience: ["Developers", "AI Engineers", "Data Scientists"],
    tone: ["Professional", "Modern", "Technical", "Clean", "Simple", "Flat"],
    constraints: {
      minimal_text:
        "The image should be visually standalone. Avoid heavy text.",
      visual_consistency: "Strictly adhere to the Brand Guidelines.",
      clean_output:
        "NEVER render design instructions as visible text in the image.",
      flat_2d_only: {
        severity: "CRITICAL",
        description:
          "Generate ONLY flat 2D diagrams. Think clean vector illustrations or whiteboard sketches.",
        strictly_forbidden: [
          "3D shapes or perspective",
          "Isometric projections",
          "Drop shadows, glows, or lighting effects",
          "Gradients on shapes (backgrounds may use subtle gradients)",
          "Reflections, shine, or glossy effects",
          "Textures or patterns on elements",
          "Depth or layering effects",
        ],
      },
      no_parenthetical_labels: {
        severity: "CRITICAL",
        description:
          "NEVER add parenthetical annotations or labels to diagram elements.",
        strictly_forbidden: [
          "Text in parentheses under or next to components",
          "Labels like (AI), (Code), (Reliable), (Input), (Output)",
          "Descriptive subtitles in parentheses such as (Flexible Intelligence), (Deterministic), (BigQuery)",
          "Any text wrapped in ( ) characters as annotations",
          "Category or type labels in parentheses beneath node names",
        ],
        rule: "If a node needs a label, use ONLY a simple name WITHOUT any parenthetical suffix.",
      },
      no_color_legends_or_hex_codes: {
        severity: "CRITICAL",
        description:
          "NEVER include color legends, swatches, or hex codes anywhere in the image.",
        strictly_forbidden: [
          "Color legend boxes or keys showing which colors mean what",
          "Color swatches with labels like 'Blue 400 (#066998)'",
          "ANY hex code in ANY format: #FFFFFF, #066998, #366666, etc.",
          "Color names with numbers like 'Violet 300', 'Green 400', 'Blue 500'",
          "ANY text starting with # followed by letters/numbers",
        ],
        rule: "The brand color palette is for YOUR internal use only. NEVER show it to viewers.",
      },
      no_langchain_community_attribution: {
        severity: "CRITICAL",
        description: "NEVER include any LangChain community attribution.",
        strictly_forbidden: [
          "LangChain Community",
          "LangChain Community Project",
          "Made by LangChain Community",
          "Any variation of LangChain Community attribution text",
        ],
        rule: "This is a clean social media image. NO LangChain Community attribution text of any kind.",
      },
      no_parrot_imagery: {
        severity: "CRITICAL",
        description:
          "Do NOT generate the LangChain logo (a parrot) or any text-based parrot imagery. NEVER render a parrot in any form.",
        strictly_forbidden: [
          "A parrot",
          "The LangChain logo (a parrot)",
          "Any text-based parrot imagery",
        ],
      },
      no_design_metadata_in_image: {
        severity: "CRITICAL",
        description:
          "ABSOLUTELY DO NOT include ANY of the following as visible text or elements:",
        forbidden_elements: [
          "Font names (Manrope, Arial, Helvetica, etc.)",
          "Design specifications (100% leading, -2.5% tracking, 16:9, etc.)",
          "Typography instructions or measurements",
          "Any technical design guidelines or parameters",
        ],
        note: "All design details in this prompt are for YOUR reference only - they must NEVER appear in the final image.",
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
        contrast:
          "Always use high-contrast pairings (Dark on Light, Light on Dark)",
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
      "Read and understand the report (detailed context), post (final social media text), and image references.",
    step_2_visual_style: {
      base_style: "Flat 2D, Geometric, and Minimal",
      architecture_diagram_aesthetic:
        "Create clean, simple diagrams that resemble technical flowcharts or system architecture diagrams. Think whiteboard sketches or documentation-style visuals.",
      visual_elements: [
        "Simple 2D shapes (rectangles, circles, rounded boxes)",
        "Clean nodes with solid fills",
        "Thin connecting lines",
        "Simple directional arrows",
        "Flat modular blocks",
      ],
      strictly_avoid: [
        "3D effects, depth, or perspective",
        "Isometric projections",
        "Drop shadows or glows",
        "Gradients on shapes (use solid colors)",
        "Reflections or shine effects",
        "Complex textures or patterns",
        "Photorealistic elements",
        "Overly detailed or busy compositions",
      ],
      style_reference:
        "Aim for the simplicity of hand-drawn whiteboard diagrams or clean SVG illustrations.",
    },
    step_3_title_generation: {
      guideline:
        "You are not forced to generate a title, but if you do, follow strict Ragging rules.",
      ragging_rules: {
        no_orphans: "Never leave a single word alone on the last line",
        natural_breaks:
          "Break lines at natural phrase boundaries (e.g., 'The platform for / reliable agents' rather than 'The platform / for reliable agents')",
        shape:
          "Aim for a balanced text block. Avoid deep steps or awkward gaps on the right edge",
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
      "No lighting effects. This is a flat 2D diagram - treat it like a vector illustration with no shadows, highlights, or ambient occlusion.",
    step_6_output:
      "A 16:9 high-resolution image suitable for Twitter/LinkedIn.",
  },
  final_reflection: {
    description:
      "CRITICAL: Before finalizing the image, perform this MANDATORY self-check. SCAN THE ENTIRE IMAGE.",
    absolute_zero_tolerance: [
      "3D EFFECTS - NO isometric views, depth, perspective, shadows, or any 3D rendering",
      "GRADIENTS ON SHAPES - Use only solid flat colors on diagram elements",
      "COMPLEX EFFECTS - NO glows, reflections, textures, or shine",
      "COLOR LEGENDS OR SWATCHES - NO boxes showing 'Blue 400 (#066998)' or similar color keys",
      "HEX CODES - NO text starting with # like #066998, #366666, #8C81F0, #F8F7FF anywhere",
      "COLOR NAMES WITH NUMBERS - NO 'Violet 300', 'Blue 400', 'Green 500' text",
      "LANGCHAIN COMMUNITY ATTRIBUTION - NO 'LangChain Community', 'LangChain Community Project', 'Made by LangChain Community'",
      "PARENTHESES - NO labels like (AI), (Code), (Input), (Output), (Reliable)",
      "FONT NAMES - Any font names (Manrope, etc.)",
      "DESIGN SPECIFICATIONS - Any design specifications (100% leading, -2.5% tracking, 16:9, etc.)",
      "TYPOGRAPHY INSTRUCTIONS OR MEASUREMENTS - Any typography instructions or measurements",
      "PARROT IMAGERY - Any parrot imagery (the LangChain logo)",
    ],
    action:
      "STOP AND CHECK: Is this a clean, flat 2D diagram? Does it contain ANY 3D effects, color legends, hex codes, or LangChain Community text? If YES, you MUST regenerate. These are FATAL errors.",
  },
  input: {
    report: "{REPORT}",
    post: "{POST}",
    style_variation: "{STYLE_VARIATION}",
  },
};

const STYLE_VARIATIONS = [
  `Violet 100 (#F8F7FF) background. Accent with Orange 300, Orange 400, and Red 300.`,
  `Violet 100 (#F8F7FF) background. Accent with Orange 300, Orange 400, and Red 300.`,
  `Violet 100 (#F8F7FF) background. Accent with Violet 200, Blue 300, and Green 300.`,
  `Violet 100 (#F8F7FF) background. Accent with Violet 200, Blue 300, and Green 300.`,
  `Blue 500 (#04305E) background. Accent with Blue 200, Violet 200, and Orange 200.`, 
  `Blue 500 (#04305E) background. Accent with Blue 300, Green 300, and Violet 200.`,
  `Green 500 (#132D27) background. Accent with Green 200, Blue 300, and Violet 300.`,
];

const getPromptString = (
  report: string,
  post: string,
  styleVariation: string,
): string => {
  const promptWithInput = {
    ...GENERATE_IMAGE_PROMPT_TEMPLATE,
    input: {
      report,
      post,
      style_variation: styleVariation,
    },
  };
  return JSON.stringify(promptWithInput, null, 2);
};

export async function generateImageWithNanoBananaPro(
  report: string,
  post: string,
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

  const prompt = getPromptString(report, post, styleVariation);

  const contents: (string | Part)[] = [prompt];

  // Add reference images (limit to 2 to avoid token limits)
  const referenceImagesWithOmissions = await Promise.all(
    imageUrls.slice(0, 2).map(async (url) => {
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
    report,
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
        report,
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
    imageResults.map(async ({ data, mimeType }) => {
      try {
        // Embed the generated image in the LangChain community template
        const templatedBuffer = await embedImageInTemplate(data, mimeType);
        return await uploadImageBufferToSupabase(
          templatedBuffer,
          `nano-banana-pro-templated`,
        );
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
