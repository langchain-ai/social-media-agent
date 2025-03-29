import { LangGraphRunnableConfig } from "@langchain/langgraph";
import * as cheerio from "cheerio";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "./generate-post/constants.js";

export const BLACKLISTED_MIME_TYPES = [
  "image/svg+xml",
  "image/x-icon",
  "image/bmp",
  "text/",
];
export const BLACKLISTED_GENERAL_URLS = ["vimeo.com"];

/**
 * Extracts URLs from Slack-style message text containing links in the format:
 * <display_text|https://example.com> or <https://example.com>
 * @param text The message text to extract URLs from
 * @returns Array of URLs found in the text
 */
export function extractUrlsFromSlackText(text: string): string[] {
  const regex = /<(?:([^|>]*)\|)?([^>]+)>/g;
  const matches = [...text.matchAll(regex)];
  return matches.map((match) => match[2]);
}

/**
 * Checks if a string ends with a file extension (e.g., 'file.md', 'doc.txt')
 * @param str The string to check
 * @returns boolean indicating if the string ends with a file extension
 */
export function hasFileExtension(str: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(str);
}

/**
 * Extracts the tweet ID from a Twitter URL
 * @param url The Twitter URL (can be string or URL object)
 * @returns The tweet ID
 * @throws Error if the tweet ID cannot be extracted
 */
export function extractTweetId(url: string | URL): string | undefined {
  const pathname = url instanceof URL ? url.pathname : new URL(url).pathname;
  const tweetId = pathname.match(/\/status\/(\d+)/)?.[1];
  return tweetId;
}

/**
 * Extracts all URLs from a given string
 * @param text The string to extract URLs from
 * @returns Array of URLs found in the text
 */
export function extractUrls(text: string): string[] {
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const urls = new Set<string>();

  // First replace all markdown links with spaces to avoid double-matching
  const processedText = text.replace(markdownLinkRegex, (match, _, url) => {
    urls.add(url);
    return " ".repeat(match.length); // Replace with spaces to preserve string length
  });

  // Then look for any remaining plain URLs in the text
  const plainUrlRegex = /https?:\/\/[^\s<\]]+(?:[^<.,:;"'\]\s)]|(?=\s|$))/g;
  const plainUrls = processedText.match(plainUrlRegex) || [];
  plainUrls.forEach((url) => urls.add(url));

  return Array.from(urls);
}

/**
 * Removes all URLs from a given string
 * @param text The string to remove URLs from
 * @returns The input string with all URLs removed
 */
export function removeUrls(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  return text.replace(urlRegex, "").replace(/\s+/g, " ").trim();
}

/**
 * Fetches and extracts the main text content from a webpage by removing common non-content elements.
 *
 * @param {string} url - The URL of the webpage to fetch and extract text from.
 * @returns {Promise<string | undefined>} The cleaned text content of the webpage, or undefined if an error occurs.
 *
 * @throws {TypeError} When the provided URL is invalid.
 * @throws {Error} When there's a network error during the request.
 *
 * @example
 * ```typescript
 * const text = await getPageText('https://example.com');
 * if (text) {
 *   console.log('Page content:', text);
 * } else {
 *   console.log('Failed to fetch page content');
 * }
 * ```
 */
export async function getPageText(url: string): Promise<string | undefined> {
  try {
    // Validate URL
    new URL(url); // Will throw if URL is invalid

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $("script").remove();
    $("style").remove();
    $("head").remove();
    $("nav").remove();
    $("footer").remove();
    $("header").remove();

    // Extract image information
    const images = $("img")
      .map((_, img) => {
        const alt = $(img).attr("alt") || "";
        const src = $(img).attr("src") || "";
        return `[Image: ${alt}](${src})`;
      })
      .get();

    // Get text content and clean it up
    const text = $("body")
      .text()
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .trim();

    // Combine text and image information
    return `${text}\n\n${images.join("\n")}`;
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("HTTP error")) {
        console.error(`Network error: ${error.message}`);
        return undefined;
      } else if (error instanceof TypeError) {
        console.error(`Invalid URL: ${error.message}`);
        return undefined;
      }

      console.error(`Unknown error: ${error.message}`);
      return undefined;
    }

    console.error("Unknown error:", error);
    return undefined;
  }
}

/**
 * Checks if a given string is a valid URL
 *
 * @param {string} str - The string to check
 * @returns {boolean} True if the string is a valid URL, false otherwise
 *
 * @example
 * ```typescript
 * isValidUrl('https://example.com'); // returns true
 * isValidUrl('not-a-url'); // returns false
 * isValidUrl('http://localhost:3000'); // returns true
 * ```
 */
export function isValidUrl(str: string): boolean {
  if (!str || typeof str !== "string") {
    return false;
  }

  try {
    new URL(str);
    return true;
  } catch (error: any) {
    if (error?.message === "Invalid URL" || error instanceof TypeError) {
      return false;
    }

    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Fetches an image from a URL and converts it to a base64 string
 *
 * @param {string} imageUrl - The URL of the image to fetch
 * @returns {Promise<string>} A Promise that resolves to the base64 string of the image
 * @throws {Error} When the URL is invalid or the fetch request fails
 *
 * @example
 * ```typescript
 * const base64String = await imageUrlToBase64('https://example.com/image.jpg');
 * console.log(base64String); // data:image/jpeg;base64,/9j/4AAQSkZJRg...
 * ```
 */
export async function imageUrlToBuffer(imageUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  if (!isValidUrl(imageUrl)) {
    throw new Error("Invalid image URL provided");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/jpeg";

  return {
    buffer: imageBuffer,
    contentType,
  };
}

/**
 * Extracts the MIME type from a base64 string.
 *
 * @param {string} base64String - The base64 string to extract MIME type from
 * @returns {string | null} The MIME type if found, null otherwise
 *
 * @throws {Error} When the input string is not a valid base64 string
 *
 * @example
 * ```typescript
 * const mimeType = extractMimeTypeFromBase64('data:image/jpeg;base64,/9j/4AAQSkZJRg...');
 * console.log(mimeType); // 'image/jpeg'
 * ```
 */
export function extractMimeTypeFromBase64(base64String: string): string | null {
  try {
    // Check if the string is empty or not a string
    if (!base64String || typeof base64String !== "string") {
      throw new Error("Invalid input: base64String must be a non-empty string");
    }

    // Check if it's a data URL
    if (base64String.startsWith("data:")) {
      const matches = base64String.match(
        /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/,
      );
      if (matches && matches.length > 1) {
        return matches[1];
      }
    }

    // If it's just a base64 string without data URL prefix, try to detect common file signatures
    const decodedString = Buffer.from(base64String, "base64")
      .toString("hex")
      .toLowerCase();

    // Common file signatures (magic numbers)
    const signatures: { [key: string]: string } = {
      ffd8ff: "image/jpeg",
      "89504e47": "image/png",
      "47494638": "image/gif",
      "25504446": "application/pdf",
      "504b0304": "application/zip",
    };

    for (const [signature, mimeType] of Object.entries(signatures)) {
      if (decodedString.startsWith(signature)) {
        return mimeType;
      }
    }

    return null;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract MIME type: ${error.message}`);
    }
    throw new Error("Failed to extract MIME type: Unknown error");
  }
}

/**
 * Processes an image input which can be a URL, base64 string, or "remove" command
 * @param imageInput The image input string (URL, base64, or "remove")
 * @returns Object containing the public image URL and MIME type, or undefined if image should be removed
 */
export async function processImageInput(
  imageInput: string,
): Promise<{ imageUrl: string; mimeType: string } | "remove" | undefined> {
  if (imageInput.toLowerCase() === "remove" || !imageInput) {
    return "remove";
  }

  if (isValidUrl(imageInput)) {
    const { contentType } = await imageUrlToBuffer(imageInput);

    if (BLACKLISTED_MIME_TYPES.find((mt) => contentType.startsWith(mt))) {
      return undefined;
    }

    return {
      imageUrl: imageInput,
      mimeType: contentType,
    };
  }

  return undefined;
}

// Regex to match markdown image syntax: ![alt text](url)
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
// Regex to match HTML img tags with src attribute (handles both single and double quotes)
const HTML_IMG_REGEX = /<img[^>]+src=["']([^"'>]+)["']/g;

/**
 * Extracts all image URLs from a markdown string, including both markdown syntax and HTML img tags
 * @param text The markdown text to search
 * @returns Array of all matched image URLs
 */
export function extractAllImageUrlsFromMarkdown(text: string): string[] {
  const urls: string[] = [];
  let match;

  // Reset regex states
  MARKDOWN_IMAGE_REGEX.lastIndex = 0;
  HTML_IMG_REGEX.lastIndex = 0;

  // Extract markdown style images
  while ((match = MARKDOWN_IMAGE_REGEX.exec(text)) !== null) {
    urls.push(match[2]);
  }

  // Extract HTML img tags
  while ((match = HTML_IMG_REGEX.exec(text)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

const BLACKLISTED_IMAGE_URL_ENDINGS = [".svg", ".ico", ".bmp"];

export function filterUnwantedImageUrls(urls: string[]): string[] {
  return urls.filter(
    (url) =>
      !BLACKLISTED_IMAGE_URL_ENDINGS.find((ending) => url.endsWith(ending)),
  );
}

/**
 * The type of a URL. One of "github", "youtube", "general"
 * `undefined` if the URL type could not be determined
 */
export type UrlType =
  | "github"
  | "youtube"
  | "general"
  | "twitter"
  | "reddit"
  | "luma"
  | undefined;

export function getUrlType(url: string): UrlType {
  let parsedUrl: URL | undefined = undefined;
  try {
    const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
    parsedUrl = new URL(formattedUrl);
  } catch (e) {
    console.error("Failed to parse URL:", e);
    return undefined;
  }

  if (
    parsedUrl.hostname.includes("github") &&
    // github.io sites should be considered general URLs
    !parsedUrl.hostname.includes("github.io")
  ) {
    return "github";
  }

  if (
    parsedUrl.hostname.includes("youtube") ||
    parsedUrl.hostname.includes("youtu.be")
  ) {
    return "youtube";
  }

  if (
    parsedUrl.hostname.includes("twitter") ||
    parsedUrl.hostname.includes("x.com")
  ) {
    return "twitter";
  }

  if (
    parsedUrl.hostname.includes("reddit") ||
    parsedUrl.hostname.includes("np.reddit") ||
    parsedUrl.hostname.includes("redd.it")
  ) {
    return "reddit";
  }

  if (parsedUrl.host === "lu.ma") {
    return "luma";
  }

  return "general";
}

/**
 * Extracts the MIME type from a URL based on its file extension or path
 * @param url The URL to extract MIME type from
 * @returns The MIME type (e.g., 'image/jpeg', 'image/png') or undefined if not determinable
 */
export function getMimeTypeFromUrl(url: string): string | undefined {
  try {
    // Handle encoded URLs (like in Substack CDN URLs)
    const decodedUrl = decodeURIComponent(url);

    // Try to find the last occurrence of a file extension
    const extensionMatch = decodedUrl.match(/\.([^./\\?#]+)(?:[?#].*)?$/i);

    if (!extensionMatch) {
      return undefined;
    }

    const extension = extensionMatch[1].toLowerCase();

    // Map common image extensions to MIME types
    const mimeTypeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      bmp: "image/bmp",
    };

    return mimeTypeMap[extension];
  } catch (error) {
    console.error("Error extracting MIME type from URL:", error);
    return undefined;
  }
}

/**
 * Removes query parameters from a URL while preserving the base URL and path
 * @param url The URL to remove query parameters from
 * @returns The URL without query parameters
 *
 * @example
 * ```typescript
 * removeQueryParams('https://example.com/path?query=123'); // returns 'https://example.com/path'
 * removeQueryParams('https://example.com'); // returns 'https://example.com'
 * ```
 */
export function removeQueryParams(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch (error) {
    // If URL parsing fails, return the original string
    return url;
  }
}

/**
 * Splits an array into smaller chunks of a specified size
 * @param {T[]} arr - The array to be chunked
 * @param {number} size - The size of each chunk
 * @returns {T[][]} An array of chunks, where each chunk is an array of size elements (except possibly the last chunk which may be smaller)
 * @template T - The type of elements in the array
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (!arr.length) return [];
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

export function isTextOnly(config?: LangGraphRunnableConfig): boolean {
  const textOnlyModeConfig = config?.configurable?.[TEXT_ONLY_MODE];
  const isTextOnlyMode =
    textOnlyModeConfig != null
      ? textOnlyModeConfig
      : process.env.TEXT_ONLY_MODE === "true";
  return isTextOnlyMode;
}

export function shouldPostToLinkedInOrg(
  config?: LangGraphRunnableConfig,
): boolean {
  const postToOrgConfig = config?.configurable?.[POST_TO_LINKEDIN_ORGANIZATION];
  const postToOrg =
    postToOrgConfig != null
      ? postToOrgConfig
      : process.env.POST_TO_LINKEDIN_ORGANIZATION === "true";
  return postToOrg;
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates delay times for processing a list of URLs to prevent rate limiting.
 * Each URL gets a minimum 30-second delay from the previous URL's processing time.
 * Twitter URLs receive an additional 30-second delay due to stricter rate limits.
 *
 * @param links - Array of URLs to process
 * @param baseDelaySeconds - The base delay time in seconds (default: 30)
 * @returns Array of objects containing the original URL and its calculated delay time
 * @example
 * // For URLs: ['https://example.com', 'https://twitter.com/user', 'https://github.com']
 * // Returns:
 * // [
 * //   { link: 'https://example.com', afterSeconds: 0 },
 * //   { link: 'https://twitter.com/user', afterSeconds: 60 }, // 30 (base) + 30 (twitter)
 * //   { link: 'https://github.com', afterSeconds: 60 } // 30 * 2 (third position)
 * // ]
 */
export function getAfterSecondsFromLinks(
  links: string[],
  options?: {
    baseDelaySeconds?: number;
  },
): {
  link: string;
  afterSeconds: number;
}[] {
  const baseDelaySeconds =
    options?.baseDelaySeconds != null ? options.baseDelaySeconds : 30;
  return links.map((link, index) => {
    const isTwitterUrl = getUrlType(link) === "twitter";
    const additionalDelay = isTwitterUrl ? baseDelaySeconds : 0;
    const afterSeconds = index * baseDelaySeconds + additionalDelay;
    return {
      link,
      afterSeconds,
    };
  });
}

/**
 * Filters an array of URLs by type. Excludes any Twitter & Reddit URLs, then returns the filtered list joined by two newlines.
 * This is used when getting the list of links which may be included in the post content.
 *
 * @param links - Array of URLs to filter
 * @returns A joined string of the filtered URLs
 */
export function filterLinksForPostContent(links: string[]): string {
  const blacklistedTypes = ["twitter", "reddit"];
  const filteredLinks = links.filter(
    (l) => !blacklistedTypes.includes(getUrlType(l) ?? ""),
  );
  return filteredLinks.join("\n\n");
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalize(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Returns true if LangChain prompts should be used
 *
 * @returns {boolean} True if LangChain prompts should be used
 */
export function useLangChainPrompts(): boolean {
  return process.env.USE_LANGCHAIN_PROMPTS === "true";
}

/**
 * Returns true if Arcade authentication should be used
 *
 * @returns {boolean} True if Arcade authentication should be used
 */
export function useArcadeAuth(): boolean {
  return process.env.USE_ARCADE_AUTH === "true";
}

/**
 * Returns true if Twitter API-only mode should be used
 *
 * @returns {boolean} True if Twitter API-only mode should be used
 */
export function useTwitterApiOnly(): boolean {
  return process.env.USE_TWITTER_API_ONLY === "true";
}
