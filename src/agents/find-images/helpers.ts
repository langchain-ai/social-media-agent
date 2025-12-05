import { fileTypeFromBuffer } from "file-type";
import { createSupabaseClient } from "../../utils/supabase.js";

const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 180; // 180 days

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

