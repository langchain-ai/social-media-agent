import { fileTypeFromBuffer } from "file-type";
import { chromium } from "playwright";
import { createSupabaseClient } from "../../utils/supabase.js";
import { COMMUNITY_TEMPLATE_SVG } from "./community-template.js";

const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 180; // 180 days

/**
 * Embed a generated image into the LangChain community template SVG
 * and render it to a PNG buffer using Playwright.
 * @param imageBase64 The base64-encoded image data to embed
 * @param mimeType The MIME type of the image (e.g., "image/png", "image/jpeg")
 * @returns {Promise<Buffer>} A buffer containing the rendered PNG image
 */
export async function embedImageInTemplate(
  imageBase64: string,
  mimeType: string,
): Promise<Buffer> {
  // Create a data URL for the generated image
  const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

  // The template has a rounded box adjusted for nano banana's 16:9 aspect ratio:
  // Path: M404 500C404 477.356 422.356 459 445 459H1476C1498.64 459 1517 477.356 1517 500V1080H404V500Z
  // This creates a centered box from (404, 459) to (1517, 1080) with rounded top corners
  // Width: 1113, Height: 621 (aspect ratio ~1.79, matching nano banana's 1376x768)

  // Replace the placeholder image data URL while keeping the SVG structure
  // The image element is inside <defs> and referenced by a pattern
  const modifiedSvg = COMMUNITY_TEMPLATE_SVG.replace(
    /xlink:href="data:image\/png;base64,[^"]+"/,
    `xlink:href="${imageDataUrl}"`,
  )
    // Update the image dimensions to match nano banana output (1376x768)
    .replace(
      /<image id="image0_212_4239" width="256" height="256"/,
      `<image id="image0_212_4239" width="1376" height="768"`,
    )
    // Update the pattern transform to properly scale the image to fill the box
    // For objectBoundingBox: scaleX = 1/width, scaleY = 1/height
    // 1/1376 ≈ 0.000726744, 1/768 ≈ 0.001302083
    .replace(
      /transform="matrix\([^)]+\)"/,
      `transform="matrix(0.000726744 0 0 0.001302083 0 0)"`,
    );

  // Use Playwright to render the SVG to PNG
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    // Set the SVG content as an HTML page
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; }
            svg { display: block; }
          </style>
        </head>
        <body>
          ${modifiedSvg}
        </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: "networkidle" });

    // Take a screenshot of the SVG
    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1920, height: 1080 },
    });

    return Buffer.from(screenshot);
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Upload an image buffer to Supabase storage and return a signed URL.
 * @param buffer The image buffer to upload
 * @param fileNamePrefix A prefix for the generated file name (e.g. "screenshot-github.com" or "generated")
 * @returns {Promise<string>} A signed URL to the uploaded image
 */
export async function uploadImageBufferToSupabase(
  buffer: Buffer,
  fileNamePrefix: string,
): Promise<string> {
  const supabase = createSupabaseClient();

  const type = await fileTypeFromBuffer(buffer);
  if (!type || !type.mime.startsWith("image/")) {
    throw new Error("Invalid image file");
  }

  const extension = type.mime.split("/")[1];
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const fileName = `${fileNamePrefix}-${Date.now()}-${randomSuffix}.${extension}`;

  const { data, error } = await supabase.storage
    .from("images")
    .upload(fileName, buffer, {
      contentType: type.mime,
      duplex: "half",
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    throw error;
  }

  const { data: signedUrlData } = await supabase.storage
    .from("images")
    .createSignedUrl(data.path, SIGNED_URL_EXPIRY);

  if (!signedUrlData?.signedUrl) {
    throw new Error("Failed to create signed URL");
  }

  return signedUrlData.signedUrl;
}
