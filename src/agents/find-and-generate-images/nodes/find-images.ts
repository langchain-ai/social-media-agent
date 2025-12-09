import * as path from "path";
import { getFileContents } from "../../../utils/github-repo-contents.js";
import {
  filterUnwantedImageUrls,
  extractAllImageUrlsFromMarkdown,
  isValidUrl,
  getUrlType,
} from "../../utils.js";
import { takeScreenshotAndUpload } from "../screenshot.js";
import { FindAndGenerateImagesAnnotation } from "../find-and-generate-images-graph.js";
import { validate } from "uuid";

function checkIsGitHubImageUrl(url: string): boolean {
  if (
    url?.startsWith("https://github.com/user-attachments/assets") ||
    url?.includes("githubusercontent.com/")
  ) {
    return true;
  }
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const split = pathname.split("/");
    const lastEle = split[split.length - 1];
    const thirdToLastEle = split[split.length - 3];
    if (thirdToLastEle === "assets" && validate(lastEle)) {
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

export async function findImages(
  state: typeof FindAndGenerateImagesAnnotation.State,
) {
  const { pageContents, imageOptions, relevantLinks } = state;
  const link = relevantLinks?.[0] || undefined;
  if (!link || !relevantLinks?.length) {
    console.warn("No relevant links passed to findImages.");
    return {};
  }
  const imageUrls = new Set<string>();
  const gitHubSubLinks = relevantLinks.filter(
    (rl) => getUrlType(rl) === "github" && rl !== link,
  );

  let screenshotUrl: string | undefined;
  if (!["youtube", "twitter"].includes(getUrlType(link) || "")) {
    screenshotUrl = await takeScreenshotAndUpload(link);
    if (screenshotUrl) {
      imageUrls.add(screenshotUrl);
    }
  }

  // Take screenshots of all GitHub links (excluding parent link)
  if (gitHubSubLinks.length) {
    for await (const ghLink of gitHubSubLinks) {
      const ghScreenshotUrl = await takeScreenshotAndUpload(ghLink);
      if (ghScreenshotUrl) {
        imageUrls.add(ghScreenshotUrl);
      }
    }
  }

  if (imageOptions?.length) {
    imageOptions.forEach((urlOrPathname) => {
      imageUrls.add(urlOrPathname);
    });
  }

  if (pageContents && pageContents.length) {
    const allImageUrls = filterUnwantedImageUrls(
      pageContents.flatMap(extractAllImageUrlsFromMarkdown),
    );

    for await (const urlOrPathname of allImageUrls) {
      if (isValidUrl(urlOrPathname)) {
        if (getUrlType(urlOrPathname) !== "github") {
          imageUrls.add(urlOrPathname);
        } else {
          // If a full github URL. extract the file name from the path. to do this, extract the path after `blob/<branch>`
          const filePath = urlOrPathname.match(/blob\/[^/]+\/(.+)/)?.[1];
          if (!filePath) {
            if (!checkIsGitHubImageUrl(urlOrPathname)) {
              console.warn(
                "Could not extract file path from URL",
                urlOrPathname,
              );
            } else {
              imageUrls.add(urlOrPathname);
            }
            continue;
          }

          const getContents = await getFileContents(urlOrPathname, filePath);
          if (getContents.download_url) {
            imageUrls.add(getContents.download_url);
          }
        }

        continue;
      }

      // We have to assume the path is from the relevant link.
      const fullUrl = new URL(link);
      if (getUrlType(link) === "github") {
        const parsedPathname = path.normalize(urlOrPathname);
        const getContents = await getFileContents(link, parsedPathname);
        imageUrls.add(getContents.download_url || fullUrl.href);
      } else {
        fullUrl.pathname = path.join(fullUrl.pathname, urlOrPathname);
        imageUrls.add(fullUrl.href);
      }
    }
  } else {
    throw new Error("No page content or images found");
  }

  return {
    imageOptions: Array.from(imageUrls),
  };
}
