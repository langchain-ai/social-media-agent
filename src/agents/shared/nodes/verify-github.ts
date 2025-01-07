import { z } from "zod";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { LANGCHAIN_PRODUCTS_CONTEXT } from "../../generate-post/prompts.js";
import { VerifyContentAnnotation } from "../shared-state.js";
import { GeneratePostAnnotation } from "../../generate-post/generate-post-state.js";
import { RunnableConfig } from "@langchain/core/runnables";
import {
  getRepoContents,
  getFileContents,
} from "../../../utils/github-repo-contents.js";
import { getModelFromConfig } from "../../utils.js";

type VerifyGitHubContentReturn = {
  relevantLinks: (typeof GeneratePostAnnotation.State)["relevantLinks"];
  pageContents: (typeof GeneratePostAnnotation.State)["pageContents"];
};

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the content from the GitHub repository is or isn't relevant to LangChain's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the content from the GitHub repository is relevant to LangChain's products.",
      ),
  })
  .describe("The relevancy of the content to LangChain's products.");

const REPO_DEPENDENCY_PROMPT = `Here are the dependencies of the repository. Inspect this file contents to determine if the repository implements LangChain's products.
<repository-dependencies file-name="{dependenciesFileName}">
{repositoryDependencies}
</repository-dependencies>`;

const VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee at LangChain.
You're given a {file_type} from a GitHub repository and need to verify the repository implements LangChain's products.
You're doing this to ensure the content is relevant to LangChain, and it can be used as marketing material to promote LangChain.

For context, LangChain has three main products you should be looking out for:
${LANGCHAIN_PRODUCTS_CONTEXT}

{repoDependenciesPrompt}

Given this context, examine the  {file_type} closely, and determine if the repository implements LangChain's products.
You should provide reasoning as to why or why not the repository implements LangChain's products, then a simple true or false for whether or not it implements some.`;

const getDependencies = async (
  githubUrl: string,
): Promise<{ fileContents: string; fileName: string } | undefined> => {
  const repoContents = await getRepoContents(githubUrl);
  if (!repoContents) {
    return undefined;
  }
  const packageJson = repoContents.find(
    (content) => content.name === "package.json" && content.type === "file",
  );
  const bowerJson = repoContents.find(
    (content) => content.name === "bower.json" && content.type === "file",
  );
  const lernaJson = repoContents.find(
    (content) => content.name === "lerna.json" && content.type === "file",
  );
  const nxJson = repoContents.find(
    (content) => content.name === "nx.json" && content.type === "file",
  );
  const pyProject = repoContents.find(
    (content) => content.name === "pyproject.toml" && content.type === "file",
  );
  const requirementsTxt = repoContents.find(
    (content) => content.name === "requirements.txt" && content.type === "file",
  );
  const setupPy = repoContents.find(
    (content) => content.name === "setup.py" && content.type === "file",
  );

  const file =
    packageJson ??
    bowerJson ??
    lernaJson ??
    nxJson ??
    pyProject ??
    requirementsTxt ??
    setupPy;

  if (!file) {
    return undefined;
  }
  const contents = await getFileContents(githubUrl, file.path);
  return {
    fileContents: contents.content,
    fileName: file.name,
  };
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
  dependenciesString: string | undefined;
  dependenciesFileName: string | undefined;
  config: LangGraphRunnableConfig;
}

export async function verifyGitHubContentIsRelevant({
  contents,
  fileType,
  dependenciesString,
  dependenciesFileName,
  config,
}: VerifyGitHubContentParams): Promise<boolean> {
  const relevancyModel = (
    await getModelFromConfig(config, {
      temperature: 0,
    })
  ).withStructuredOutput(RELEVANCY_SCHEMA, {
    name: "relevancy",
  });

  const dependenciesPrompt =
    dependenciesString && dependenciesFileName
      ? REPO_DEPENDENCY_PROMPT.replace(
          "{dependenciesFileName}",
          dependenciesFileName,
        ).replace("{repositoryDependencies}", dependenciesString)
      : "";

  const { relevant } = await relevancyModel
    .withConfig({
      runName: "check-github-relevancy-model",
    })
    .invoke(
      [
        {
          role: "system",
          content: VERIFY_LANGCHAIN_RELEVANT_CONTENT_PROMPT.replaceAll(
            "{file_type}",
            fileType,
          ).replaceAll("{repoDependenciesPrompt}", dependenciesPrompt),
        },
        {
          role: "user",
          content: contents,
        },
      ],
      config as RunnableConfig,
    );
  return relevant;
}

/**
 * Verifies the content provided is relevant to LangChain products.
 */
export async function verifyGitHubContent(
  state: typeof VerifyContentAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<VerifyGitHubContentReturn> {
  const contentsAndType = await getGitHubContentsAndTypeFromUrl(state.link);
  if (!contentsAndType) {
    console.warn("No contents found for GitHub URL", state.link);
    return {
      relevantLinks: [],
      pageContents: [],
    };
  }

  const dependencies = await getDependencies(state.link);
  const relevant = await verifyGitHubContentIsRelevant({
    contents: contentsAndType.contents,
    fileType: contentsAndType.fileType,
    dependenciesString: dependencies?.fileContents,
    dependenciesFileName: dependencies?.fileName,
    config,
  });
  if (relevant) {
    return {
      relevantLinks: [state.link],
      pageContents: [contentsAndType.contents],
    };
  }

  // Not relevant, return empty arrays so this URL is not included.
  return {
    relevantLinks: [],
    pageContents: [],
  };
}
