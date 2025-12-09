import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { createSupabaseClient } from "../../utils/supabase.js";
import { COMMUNITY_TEMPLATE_SVG } from "./community-template.js";

const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 180; // 180 days

/**
 * Embed a generated image into the LangChain community template SVG
 * and render it to a PNG buffer using Sharp.
 * @param imageBase64 The base64-encoded image data to embed
 * @param mimeType The MIME type of the image (e.g., "image/png", "image/jpeg")
 * @returns {Promise<Buffer>} A buffer containing the rendered PNG image
 */
export async function embedImageInTemplate(
  imageBase64: string,
  mimeType: string,
): Promise<Buffer> {
  const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

  // Replace the placeholder image data URL with the actual generated image
  const svgWithImage = COMMUNITY_TEMPLATE_SVG.replace(
    /xlink:href="data:image\/[^"]+"/,
    `xlink:href="${imageDataUrl}"`,
  );

  // Update image dimensions from placeholder (256x256) to 16:9 output (1376x768)
  const svgWithDimensions = svgWithImage.replace(
    /<image id="image0_386_2969" width="256" height="256" preserveAspectRatio="none"/,
    `<image id="image0_386_2969" width="1376" height="768" preserveAspectRatio="none"`,
  );

  // Calculate transform matrix to scale image to fill the pattern box
  const imageWidth = 1376;
  const imageHeight = 768;
  const scaleX = 1 / imageWidth;
  const scaleY = 1 / imageHeight;

  // Apply transform matrix: scale image to fill pattern, no translation needed (both 16:9)
  const modifiedSvg = svgWithDimensions.replace(
    /transform="matrix\([^)]+\)"/,
    `transform="matrix(${scaleX} 0 0 ${scaleY} 0 0)"`,
  );

  const pngBuffer = await sharp(Buffer.from(modifiedSvg))
    .png()
    .resize(3000, 3000)
    .toBuffer();

  return pngBuffer;
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
