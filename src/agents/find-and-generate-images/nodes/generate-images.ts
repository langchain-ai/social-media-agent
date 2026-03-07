import { GoogleGenAI, Part } from "@google/genai";
import {
  getMimeTypeFromUrl,
  imageUrlToBuffer,
  retryWithTimeout,
  sleep,
} from "../../utils.js";
import { FindAndGenerateImagesAnnotation } from "../find-and-generate-images-graph.js";
import {
  embedImageInTemplate,
  uploadImageBufferToSupabase,
} from "../helpers.js";

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
          "Color swatches with labels like 'Blue (#7FC8FF)'",
          "ANY hex code in ANY format: #FFFFFF, #030710, #7FC8FF, etc.",
          "Color token names like 'lc-blue', 'lc-dark', 'lc-surface'",
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
          "Content Spotlight",
          "Community Spotlight",
          "Any variation of LangChain Community attribution text",
        ],
        rule: "This is a clean social media image. NO LangChain Community attribution text of any kind.",
      },
      no_logo_imagery: {
        severity: "CRITICAL",
        description:
          "Do NOT generate the LangChain logo (a pinwheel mark) or any text-based logo imagery. NEVER render the pinwheel in any form.",
        strictly_forbidden: [
          "A pinwheel",
          "The LangChain logo (a pinwheel)",
          "Any text-based pinwheel or logo imagery",
          "A parrot (old logo)",
        ],
      },
      no_design_metadata_in_image: {
        severity: "CRITICAL",
        description:
          "ABSOLUTELY DO NOT include ANY of the following as visible text or elements:",
        forbidden_elements: [
          "Font names (Lausanne, Inter, Arial, Helvetica, etc.)",
          "Design specifications (line-height, tracking, 16:9, etc.)",
          "Typography instructions or measurements",
          "Any technical design guidelines or parameters",
        ],
        note: "All design details in this prompt are for YOUR reference only - they must NEVER appear in the final image.",
      },
      no_all_caps_text: {
        severity: "CRITICAL",
        description:
          "NEVER generate text in all capital letters. Use proper sentence case or title case for all text in the image.",
        strictly_forbidden: [
          "Text rendered in ALL CAPS",
          "Words or phrases in uppercase letters",
          "Headlines or titles in all capital letters",
          "Labels or annotations in all caps",
        ],
        rule: "All text must use proper capitalization: sentence case for body text, title case for headlines. NO ALL CAPS TEXT.",
      },
    },
  },
  brand_guidelines: {
    typography: {
      primary_typeface: "Lausanne",
      fallback: "Inter, sans-serif",
      style: "Clean geometric sans-serif; aimed at clarity and modern appeal",
      headline: {
        weight: "700-800",
        leading: "1.15-1.25 - tight, legible spacing",
        tracking: "-0.03em to -0.01em - polished, modern look",
        alignment: {
          primary: "Left-aligned",
          secondary: "Centered (only for short headlines)",
          prohibited: ["Right-aligned", "Justified"],
        },
      },
      body_text: {
        weight: "400",
        leading: "1.65 - maximize readability",
        tracking: "0 - standard spacing",
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
        "Do not use all capital letters - use proper sentence case or title case",
      ],
    },
    color_palette: {
      core: {
        dark: "#030710",
        card: "#0B1120",
        card_alt: "#E5F4FF",
        surface: "#F2FAFF",
        border: "#B8DFFF",
        border_dark: "#1A2740",
        muted: "#6B8299",
        body: "#C8DDF0",
        white: "#FFFFFF",
        dark_text: "#030710",
      },
      accent: {
        blue: "#7FC8FF",
        blue_hover: "#99D4FF",
        blue_bg: "#E5F4FF",
        blue_bg_alt: "#F2FAFF",
      },
      secondary: {
        lime: "#E3FF8F",
        rose: "#B27D75",
        pink: "#C78EAD",
        lavender: "#D5C3F7",
      },
    },
    usage_rules: {
      color_pairing: {
        contrast:
          "Always use high-contrast pairings (Light text on dark backgrounds, dark text on light backgrounds)",
        prohibited: [
          "Low contrast (e.g., light text on light backgrounds)",
          "Clashing colors that vibrate or reduce visibility",
        ],
      },
      secondary_accents:
        "Use lime, rose, pink, and lavender sparingly alongside the primary blue. They work well for differentiating categories in diagrams.",
      gradients: {
        usage: "Sparingly. Use for backgrounds or overlays only.",
        constraints: [
          "Do not use gradients on text (text must be solid)",
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
        "Simple 2D shapes (rectangles, circles, rounded boxes with 16px radius)",
        "Clean nodes with solid fills",
        "Thin connecting lines and stroke-based elements",
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
        "Aim for the simplicity of hand-drawn whiteboard diagrams or clean SVG illustrations with stroke-based icons.",
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
      font_specs:
        "Use the Lausanne (or Inter fallback) typeface with tight, modern spacing",
      capitalization:
        "Use title case or sentence case. NEVER use all capital letters for any text.",
    },
    step_4_colors_and_backgrounds: {
      strategy:
        "Select a background color based on the mood or content type, using the approved dark or light backgrounds.",
      approved_backgrounds: [
        { name: "Dark", hex: "#030710" },
        { name: "Card Dark", hex: "#0B1120" },
        { name: "Surface Light", hex: "#F2FAFF" },
        { name: "Blue Background", hex: "#E5F4FF" },
      ],
      text_contrast:
        "Dark background (#030710, #0B1120): use White (#FFFFFF) or body light (#C8DDF0) text. Light background (#F2FAFF, #E5F4FF): use dark text (#030710).",
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
      "COLOR LEGENDS OR SWATCHES - NO boxes showing color keys or hex values",
      "HEX CODES - NO text starting with # like #7FC8FF, #030710, #E3FF8F anywhere",
      "COLOR TOKEN NAMES - NO 'lc-blue', 'lc-dark', 'lc-surface' text",
      "LANGCHAIN COMMUNITY ATTRIBUTION - NO 'LangChain Community', 'Content Spotlight', 'Community Spotlight'",
      "PARENTHESES - NO labels like (AI), (Code), (Input), (Output), (Reliable)",
      "FONT NAMES - Any font names (Lausanne, Inter, etc.)",
      "DESIGN SPECIFICATIONS - Any design specifications (line-height, tracking, 16:9, etc.)",
      "TYPOGRAPHY INSTRUCTIONS OR MEASUREMENTS - Any typography instructions or measurements",
      "LOGO IMAGERY - Any pinwheel or parrot imagery (the LangChain logos)",
      "ALL CAPS TEXT - NO text in all capital letters. Use proper sentence case or title case only.",
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
  `Light plum (#C78EAD) background. Dark navy (#030710) text and elements. Use #EBD0F0 for card backgrounds and highlights.`,
  `Lavender (#EBD0F0) background. Dark navy (#030710) text and elements. Use #C78EAD for accent elements and highlights.`,
  `Light blue (#7FC8FF) background. Dark navy (#030710) text and elements. Use #99D3FF for secondary fills and #F2FAFF for card backgrounds.`,
  `Light tint 1 (#99D3FF) background. Dark navy (#030710) text and elements. Use #7FC8FF for accent elements and #B2DEFF for secondary fills.`,
  `Light tint 2 (#B2DEFF) background. Dark navy (#030710) text and elements. Use #7FC8FF for accent elements and #CCE9FF for card backgrounds.`,
  `Light tint 3 (#CCE9FF) background. Dark navy (#030710) text and elements. Use #7FC8FF for accent elements and #E5F4FF for card backgrounds.`,
  `Light tint 4 (#E5F4FF) background. Dark navy (#030710) text and elements. Use #7FC8FF for accent elements and #F2FAFF for card backgrounds.`,
  `Light tint 5 (#F2FAFF) background. Dark navy (#030710) text and elements. Use #7FC8FF for accent elements and #B2DEFF for secondary fills.`,
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

  const randomGeneratedImage =
    generatedImages[Math.floor(Math.random() * generatedImages.length)];

  return {
    imageOptions: [...uploadedUrls, ...imageUrlsArray],
    image_candidates: [...generatedImages, ...existingCandidatesArray],
    image: randomGeneratedImage,
  };
}
