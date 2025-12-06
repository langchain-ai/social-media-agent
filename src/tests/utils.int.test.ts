import * as path from "path";
import * as fs from "fs/promises";
import { describe, it, expect } from "@jest/globals";
import {
  getFileContents,
  getRepoContents,
} from "../utils/github-repo-contents.js";
import { takeScreenshot } from "../utils/screenshot.js";
import {
  GITHUB_BROWSER_CONTEXT_OPTIONS,
  GITHUB_SCREENSHOT_OPTIONS,
} from "../agents/generate-post/constants.js";
import { parseResult } from "../agents/find-and-generate-images/nodes/validate-images.js";
import { takeScreenshotAndUpload } from "../agents/find-and-generate-images/screenshot.js";

describe("GitHub utils", () => {
  it("Can fetch the files and folders of a public GitHub repo", async () => {
    const repoUrl = "https://github.com/langchain-ai/open-canvas";
    const contents = await getRepoContents(repoUrl);
    console.log(contents);
    expect(contents.length).toBeGreaterThan(1);
  });

  it("Can get the contents of a file from a public GitHub repo", async () => {
    const repoUrl = "https://github.com/langchain-ai/open-canvas";
    const contents = await getRepoContents(repoUrl);
    const packageJson = contents.find(
      (content) => content.name === "package.json" && content.type === "file",
    );
    expect(packageJson).toBeDefined();
    if (!packageJson) return;

    const packageJsonContents = await getFileContents(
      repoUrl,
      packageJson.path,
    );
    expect(packageJsonContents.content).toBeDefined();
    expect(packageJsonContents.content.length).toBeGreaterThan(10);
    expect(packageJsonContents.type).toBe("file");
  });
});

describe("Screenshot utils", () => {
  const writeScreenshotToFile = async (
    screenshotBuffer: Buffer,
    screenshotFileName: string,
  ) => {
    const rootDir = "./src/tests/data/screenshots/";
    // Create the directory if it doesn't exist
    await fs.mkdir(rootDir, { recursive: true });
    const screenshotPath = path.join(rootDir, screenshotFileName);
    await fs.writeFile(screenshotPath, screenshotBuffer);
    console.log(`Screenshot saved to ${screenshotPath}`);
  };

  const generalUrl =
    "https://cckeh.hashnode.dev/building-chatbots-with-memory-capabilities-a-comprehensive-tutorial-with-langchain-langgraph-gemini-ai-and-mongodb";
  const repoUrl = "https://github.com/langchain-ai/open-canvas";

  it("Can take a screenshot of a GitHub repo", async () => {
    const screenshotBuffer = await takeScreenshot(repoUrl);
    expect(screenshotBuffer).toBeDefined();
    // write screenshot to file
    await writeScreenshotToFile(screenshotBuffer, "github-screenshot.png");
  });

  it("Can take a screenshot of a general URL", async () => {
    const screenshotBuffer = await takeScreenshot(generalUrl);
    expect(screenshotBuffer).toBeDefined();
    // write screenshot to file
    await writeScreenshotToFile(screenshotBuffer, "general-screenshot.png");
  });

  it("Can take a screenshot of a GitHub repo and upload it to Supabase", async () => {
    const screenshotUrl = await takeScreenshotAndUpload(repoUrl);
    console.log("screenshotUrl", screenshotUrl);
    expect(screenshotUrl).toBeDefined();
    if (!screenshotUrl) return;

    const parsedUrl = new URL(screenshotUrl);
    expect(parsedUrl).toBeDefined();
  });

  it("Can take a screenshot of a general URL and upload it to Supabase", async () => {
    const screenshotUrl = await takeScreenshotAndUpload(generalUrl);
    console.log("screenshotUrl", screenshotUrl);
    expect(screenshotUrl).toBeDefined();
    if (!screenshotUrl) return;

    const parsedUrl = new URL(screenshotUrl);
    expect(parsedUrl).toBeDefined();
  });

  it("Can take a screenshot of a GitHub readme and clip only the file contents", async () => {
    const screenshot = await takeScreenshot(`${repoUrl}/blob/main/README.md`, {
      screenshotOptions: GITHUB_SCREENSHOT_OPTIONS,
      browserContextOptions: GITHUB_BROWSER_CONTEXT_OPTIONS,
    });

    expect(screenshot).toBeDefined();
    await writeScreenshotToFile(screenshot, "github-readme-screenshot.jpeg");
  });

  it("Can extract the relevant indices from a string", () => {
    // Test single number
    const singleNumberStr = `
<answer>
<analysis>
The image shows a user interface for interacting with a "Godel Agent," which is described as a self-referential AI agent. The interface includes a query input and an output area that explains the agent's key features. The image directly illustrates the core concept of the post, which is about the Godel Agent and its self-improvement capabilities. The image also aligns with the technical and informative tone of the post and report.
</analysis>
<relevant_indices>0</relevant_indices>
</answer>`;
    expect(parseResult(singleNumberStr)).toEqual([0]);

    // Test multiple comma-separated numbers
    const multipleNumbersStr = `
<answer>
<analysis>
Multiple relevant images found that align with the content.
</analysis>
<relevant_indices>0, 2, 4</relevant_indices>
</answer>`;
    expect(parseResult(multipleNumbersStr)).toEqual([0, 2, 4]);

    // Test empty result
    const emptyStr = `
<answer>
<analysis>
No relevant images found.
</analysis>
<relevant_indices></relevant_indices>
</answer>`;
    expect(parseResult(emptyStr)).toEqual([]);

    // Test with whitespace and newlines
    const messyStr = `
<answer>
<analysis>
Some images are relevant.
</analysis>
<relevant_indices>
  1,
  3,
  5
</relevant_indices>
</answer>`;
    expect(parseResult(messyStr)).toEqual([1, 3, 5]);
  });
});
