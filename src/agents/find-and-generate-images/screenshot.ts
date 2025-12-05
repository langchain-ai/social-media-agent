import type { BrowserContextOptions, PageScreenshotOptions } from "playwright";
import {
  getRepoContents,
  getFileContents,
} from "../../utils/github-repo-contents.js";
import { takeScreenshot } from "../../utils/screenshot.js";
import {
  GITHUB_SCREENSHOT_OPTIONS,
  GITHUB_BROWSER_CONTEXT_OPTIONS,
} from "../generate-post/constants.js";
import { getUrlType } from "../utils.js";
import { uploadImageBufferToSupabase } from "./helpers.js";

/**
 * Take a screenshot of a URL and upload it to Supabase.
 * @param url The URL to take a screenshot of
 * @returns {Promise<string | undefined>} A public URL to the screenshot or undefined if the screenshot could not be taken
 */
export async function takeScreenshotAndUpload(
  url: string,
): Promise<string | undefined> {
  const screenshotUrl = await getUrlForScreenshot(url);
  const urlType = getUrlType(url);
  if (!screenshotUrl) {
    console.warn("No screenshot URL found for", url);
    return undefined;
  }

  let screenshotOptions: PageScreenshotOptions = {};
  let browserContextOptions: BrowserContextOptions = {};
  if (urlType === "github") {
    // We want to clip GitHub screenshots to only include the README contents.
    screenshotOptions = GITHUB_SCREENSHOT_OPTIONS;
    browserContextOptions = GITHUB_BROWSER_CONTEXT_OPTIONS;
  }

  try {
    const screenshotBuffer = await takeScreenshot(screenshotUrl, {
      screenshotOptions,
      browserContextOptions,
    });
    const urlHostName = new URL(screenshotUrl).hostname;

    return await uploadImageBufferToSupabase(
      screenshotBuffer,
      `screenshot-${urlHostName}`,
    );
  } catch (error) {
    console.error("Error taking and uploading screenshot:", error);
    throw error;
  }
}

/**
 * Gets the URL for a screenshot given the base URL. Mainly used to either avoid
 * taking a screenshot of a YouTube video, or getting the proper URL for GitHub repos.
 * @param url The URL to take a screenshot of
 * @returns {Promise<string | undefined>} A public URL to use to take the screenshot or undefined if the URL is not supported
 */
async function getUrlForScreenshot(url: string): Promise<string | undefined> {
  const urlType = getUrlType(url);
  // Do not attempt to take a screenshot of YouTube URLs (should get thumbnail instead)
  // or undefined types as those are not supported
  if (!urlType || urlType === "youtube") return undefined;

  if (urlType === "github") {
    const repoContents = await getRepoContents(url);
    const readmePath = repoContents.find(
      (c) =>
        c.name.toLowerCase() === "readme.md" ||
        c.name.toLowerCase() === "readme",
    )?.path;
    // Fallback to root of repo if no README is found.
    if (!readmePath) {
      return url;
    }
    const readmeContents = await getFileContents(url, readmePath);
    // HTML URLs are the public human-readable URL.
    return readmeContents.html_url || url;
  }
  return url;
}
