import { z } from "zod";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyContentAnnotation } from "../shared-state.js";
import { GeneratePostAnnotation } from "../../generate-post/generate-post-state.js";
import {
  getRepoContents,
  getFileContents,
  getOwnerRepoFromUrl,
} from "../../../utils/github-repo-contents.js";
import { Octokit } from "@octokit/rest";
import { shouldExcludeGitHubContent } from "../../should-exclude.js";
import { skipContentRelevancyCheck } from "../../utils.js";
import { verifyContentIsRelevant } from "./verify-content.js";

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  const octokit = new Octokit({
    auth: token,
  });

  return octokit;
}

type VerifyGitHubContentReturn = {
  relevantLinks: (typeof GeneratePostAnnotation.State)["relevantLinks"];
  pageContents: (typeof GeneratePostAnnotation.State)["pageContents"];
};

const RELEVANCY_SCHEMA = z
  .object({
    langchain_usage: z
      .string()
      .describe(
        "Describe the role LangChain's products/services play in this repository. Include how they're used, and if they play a meaningful role in the repository.",
      ),
    competitors_analysis: z
      .string()
      .optional()
      .describe(
        "Describe the role competitors play in this repository, if any. If no competitors are mentioned, you may leave this blank. If any are, include how they're used, and if they play a meaningful role in the repository.",
      ),
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the content from the GitHub repository is or isn't relevant to your company's products. Include points from the langchain_usage and competitors_analysis in your final reasoning decision into why the repository is or isn't relevant.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the content from the GitHub repository is relevant to your company's products. Only answer this field after reasoning on all the fields above (langchain_usage, competitors_analysis, reasoning).",
      ),
  })
  .describe("The relevancy of the content to LangChain's products/services.");

const REPO_DEPENDENCY_PROMPT = `Here are the dependencies of the repository. You should use the dependencies listed to determine if the repository is relevant.
<repository-dependency-files>
{dependencyFiles}
</repository-dependency-files>`;

const VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee at LangChain.
You're given a {file_type} from a GitHub repository and need to verify the repository implements your company's products.
You're doing this to ensure the content is relevant to LangChain, and it can be used as marketing material to promote LangChain.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

{repoDependenciesPrompt}

Given this context, examine the  {file_type} closely, and determine if the repository implements your company's products.
You should provide reasoning as to why or why not the repository implements your company's products, then a simple true or false for whether or not it implements some.`;

const getDependencies = async (
  githubUrl: string,
): Promise<Array<{ fileContents: string; fileName: string }> | undefined> => {
  const octokit = getOctokit();

  const { owner, repo } = getOwnerRepoFromUrl(githubUrl);

  const dependenciesCodeFileQuery = `filename:package.json OR filename:requirements.txt OR filename:pyproject.toml`;
  const dependenciesCodeFiles = await octokit.search.code({
    q: `${dependenciesCodeFileQuery} repo:${owner}/${repo}`,
    limit: 5,
  });
  if (dependenciesCodeFiles.data.total_count === 0) {
    return undefined;
  }

  const fileContents = (
    await Promise.all(
      dependenciesCodeFiles.data.items.flatMap(async (item) => {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: item.path,
        });

        if (!("content" in data)) {
          return undefined;
        }

        return {
          fileName: item.name,
          fileContents: Buffer.from(data.content, "base64").toString("utf-8"),
        };
      }),
    )
  ).filter((file) => file !== undefined) as Array<{
    fileName: string;
    fileContents: string;
  }>;

  return fileContents;
};

export async function getGitHubContentsAndTypeFromUrl(url: string): Promise<
  | {
      contents: string;
      fileType: string;
    }
  | undefined
> {
  const repoContents = await getRepoContents(url);
  const readmePath = repoContents.find(
    (c) =>
      c.name.toLowerCase() === "readme.md" || c.name.toLowerCase() === "readme",
  )?.path;
  if (!readmePath) {
    return undefined;
  }
  const readmeContents = await getFileContents(url, readmePath);
  return {
    contents: readmeContents.content,
    fileType: "README file",
  };
}

interface VerifyGitHubContentParams {
  contents: string;
  fileType: string;
  dependencyFiles:
    | Array<{ fileContents: string; fileName: string }>
    | undefined;
}

async function verifyGitHubContentIsRelevant({
  contents,
  fileType,
  dependencyFiles,
}: VerifyGitHubContentParams): Promise<boolean> {
  let dependenciesPrompt = "";
  if (dependencyFiles) {
    dependencyFiles.forEach((f) => {
      // Format it as a markdown code block with the file name as the header.
      dependenciesPrompt += `\`\`\`${f.fileName}\n${f.fileContents}\n\`\`\`\n`;
    });

    dependenciesPrompt = REPO_DEPENDENCY_PROMPT.replace(
      "{dependencyFiles}",
      dependenciesPrompt,
    );
  }

  const systemPrompt = VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT.replaceAll(
    "{file_type}",
    fileType,
  ).replaceAll("{repoDependenciesPrompt}", dependenciesPrompt);

  return verifyContentIsRelevant(contents, {
    systemPrompt,
    schema: RELEVANCY_SCHEMA,
  });
}

/**
 * Verifies the content provided is relevant to LangChain products.
 */
export async function verifyGitHubContent(
  state: typeof VerifyContentAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<VerifyGitHubContentReturn> {
  const shouldExclude = shouldExcludeGitHubContent(state.link);
  if (shouldExclude) {
    return {
      relevantLinks: [],
      pageContents: [],
    };
  }

  const contentsAndType = await getGitHubContentsAndTypeFromUrl(state.link);
  if (!contentsAndType) {
    console.warn("No contents found for GitHub URL", state.link);
    return {
      relevantLinks: [],
      pageContents: [],
    };
  }

  const returnValue = {
    relevantLinks: [state.link],
    pageContents: [contentsAndType.contents],
  };

  if (await skipContentRelevancyCheck(config.configurable)) {
    return returnValue;
  }

  const dependencyFiles = await getDependencies(state.link);
  if (
    await verifyGitHubContentIsRelevant({
      contents: contentsAndType.contents,
      fileType: contentsAndType.fileType,
      dependencyFiles,
    })
  ) {
    return returnValue;
  }

  // Not relevant, return empty arrays so this URL is not included.
  return {
    relevantLinks: [],
    pageContents: [],
  };
}
