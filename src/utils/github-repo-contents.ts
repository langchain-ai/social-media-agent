import { Octokit } from "@octokit/rest";

interface RepoContent {
  name: string;
  type: "file" | "dir";
  path: string;
  size?: number;
}

interface FileContent {
  content: string;
  type: "file";
  encoding: string;
  size: number;
  path: string;
  sha: string;
  name: string;
  url: string;
  git_url: string | null;
  html_url: string | null;
  download_url: string | null;
}

export function getOwnerRepoFromUrl(repoUrl: string): {
  owner: string;
  repo: string;
} {
  const url = new URL(repoUrl);

  if (url.hostname !== "github.com") {
    throw new Error("URL must be a GitHub repository URL");
  }

  // Remove leading slash and split path segments
  const pathSegments = url.pathname.slice(1).split("/");

  if (pathSegments.length < 2) {
    throw new Error(
      "Invalid GitHub repository URL: missing owner or repository name",
    );
  }

  const [owner, repo] = pathSegments;
  const cleanRepo = repo.replace(".git", "");

  return { owner, repo: cleanRepo };
}

/**
 * Fetches the contents of a GitHub repository's root directory
 * @param repoUrl - The full GitHub repository URL (e.g., 'https://github.com/owner/repo')
 * @returns Promise<RepoContent[]> - Array of files and directories in the repository root
 * @throws {Error} If GITHUB_TOKEN is not set in environment variables
 * @throws {Error} If the URL is invalid or not a GitHub repository
 * @throws {Error} If the API request fails
 */
export async function getRepoContents(repoUrl: string): Promise<RepoContent[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  const octokit = new Octokit({
    auth: token,
  });

  try {
    const { owner, repo } = getOwnerRepoFromUrl(repoUrl);

    try {
      // First, check if the repoUrl is a subdirectory (not the root directory)
      // if it is, attempt to fetch a README.md file in the directory
      if (repoUrl.includes("/tree/") || repoUrl.includes("/blob/")) {
        // Extract the path after tree or blob
        let fullPath = "";
        if (repoUrl.includes("/tree/")) {
          fullPath = repoUrl.split("/tree/").pop() || "";
        } else if (repoUrl.includes("/blob/")) {
          fullPath = repoUrl.split("/blob/").pop() || "";
        }
        
        // Remove trailing slash if present
        fullPath = fullPath.replace(/\/$/, "");
        
        // The first segment is the branch name, the rest is the actual path
        const pathSegments = fullPath.split("/");
        // Skip the branch name (first segment) and get the actual path
        const path = pathSegments.slice(1).join("/");
        
        if (path) {
          // This is not guaranteed to be a sub-directory, b/c it could be a top level file, but we should look anyways.
          const subDirectoryResponse = await octokit.repos.getContent({
            owner,
            repo,
            path,
          });
          
          // Check if the response is for a single file (not an array)
          if (!Array.isArray(subDirectoryResponse.data) && 'type' in subDirectoryResponse.data && subDirectoryResponse.data.type === "file") {
            return [{
              name: path.split('/').pop() || path, // Get the file name from the path
              type: "file",
              path: path,
              size: subDirectoryResponse.data.size,
            }];
          }
        }
      }

      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: "", // empty path for root directory
      });

      if (!Array.isArray(response.data)) {
        throw new Error("Unexpected API response format");
      }

      return response.data.map((item) => ({
        name: item.name,
        type: item.type as "file" | "dir",
        path: item.path,
        size: item.size,
      }));
    } catch (e) {
      throw new Error(
        "Failed to fetch repository contents for " + repoUrl + "\nError: " + e,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch repository contents: ${error.message}\n\nRepo URL: ${repoUrl}`,
      );
    }
    throw error;
  }
}

/**
 * Gets the contents of a specific directory in a GitHub repository
 * @param repoUrl - The full GitHub repository URL (e.g., 'https://github.com/owner/repo')
 * @param directoryPath - The path to the directory within the repository (e.g., 'src/utils')
 * @returns Promise<RepoContent[]> - Array of files and directories in the specified directory
 * @throws {Error} If GITHUB_TOKEN is not set in environment variables
 * @throws {Error} If the URL is invalid or not a GitHub repository
 * @throws {Error} If the directory path doesn't exist
 * @throws {Error} If the API request fails
 */
export async function getDirectoryContents(
  repoUrl: string,
  directoryPath: string,
): Promise<RepoContent[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  const octokit = new Octokit({
    auth: token,
  });

  try {
    const url = new URL(repoUrl);

    if (url.hostname !== "github.com") {
      throw new Error("URL must be a GitHub repository URL");
    }

    const pathSegments = url.pathname.slice(1).split("/");

    if (pathSegments.length < 2) {
      throw new Error(
        "Invalid GitHub repository URL: missing owner or repository name",
      );
    }

    const [owner, repo] = pathSegments;
    const cleanRepo = repo.replace(".git", "");

    // Normalize directory path by removing leading and trailing slashes
    const normalizedPath = directoryPath.replace(/^\/+|\/+$/g, "");

    const response = await octokit.repos.getContent({
      owner,
      repo: cleanRepo,
      path: normalizedPath,
    });

    if (!Array.isArray(response.data)) {
      throw new Error(`Path '${normalizedPath}' does not point to a directory`);
    }

    return response.data.map((item) => ({
      name: item.name,
      type: item.type as "file" | "dir",
      path: item.path,
      size: item.size,
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch directory contents: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Gets the contents of a specific file in a GitHub repository
 * @param repoUrl - The full GitHub repository URL (e.g., 'https://github.com/owner/repo')
 * @param filePath - The path to the file within the repository (e.g., 'src/utils/file.ts')
 * @returns Promise<FileContent> - Object containing the file's content and metadata
 * @throws {Error} If GITHUB_TOKEN is not set in environment variables
 * @throws {Error} If the URL is invalid or not a GitHub repository
 * @throws {Error} If the file path doesn't exist or points to a directory
 * @throws {Error} If the API request fails
 */
export async function getFileContents(
  repoUrl: string,
  filePath: string,
): Promise<FileContent> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  const octokit = new Octokit({
    auth: token,
  });

  try {
    const url = new URL(repoUrl);

    if (url.hostname !== "github.com") {
      throw new Error("URL must be a GitHub repository URL");
    }

    const pathSegments = url.pathname.slice(1).split("/");

    if (pathSegments.length < 2) {
      throw new Error(
        "Invalid GitHub repository URL: missing owner or repository name",
      );
    }

    const [owner, repo] = pathSegments;
    const cleanRepo = repo.replace(".git", "");

    // Normalize file path by removing leading and trailing slashes and query parameters
    const normalizedPath = filePath.split("?")[0].replace(/^\/+|\/+$/g, "");
    const response = await octokit.repos.getContent({
      owner,
      repo: cleanRepo,
      path: normalizedPath,
    });

    if (Array.isArray(response.data)) {
      throw new Error(
        `Path '${normalizedPath}' points to a directory, not a file`,
      );
    }

    if (response.data.type !== "file") {
      throw new Error(
        `Path '${normalizedPath}' is not a regular file (type: ${response.data.type})`,
      );
    }

    // GitHub returns file content as base64 encoded string
    const content = response.data.content
      ? Buffer.from(response.data.content, "base64").toString("utf-8")
      : "";

    return {
      content,
      type: response.data.type,
      encoding: response.data.encoding,
      size: response.data.size,
      path: response.data.path,
      sha: response.data.sha,
      name: response.data.name,
      url: response.data.url,
      git_url: response.data.git_url,
      html_url: response.data.html_url,
      download_url: response.data.download_url,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch file contents: ${error.message}`);
    }
    throw error;
  }
}
