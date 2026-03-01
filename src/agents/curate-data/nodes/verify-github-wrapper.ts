import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { CurateDataState } from "../state.js";
import { GitHubTrendingData } from "../types.js";
import { verifyGitHubContent } from "../../shared/nodes/verify-github.js";
import { getOwnerRepoFromUrl } from "../../../utils/github-repo-contents.js";

async function fetchStargazersCount(repoURL: string): Promise<number> {
  try {
    const { owner, repo } = getOwnerRepoFromUrl(repoURL);
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
        : {},
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.stargazers_count ?? 0;
  } catch {
    return 0;
  }
}

export async function verifyGitHubWrapper(
  state: CurateDataState,
  config: LangGraphRunnableConfig,
): Promise<Partial<CurateDataState>> {
  const verifiedRepoData: GitHubTrendingData[] = [];

  // Iterate over each raw GitHub repo & verify + extract page contents
  for await (const repoURL of state.rawTrendingRepos) {
    const results = await verifyGitHubContent(
      {
        link: repoURL,
      },
      config,
    );

    if (
      results.relevantLinks &&
      results.relevantLinks.length > 0 &&
      results.pageContents &&
      results.pageContents.length > 0
    ) {
      verifiedRepoData.push({
        repoURL,
        pageContent: results.pageContents[0],
      });
    }
  }

  await Promise.all(
    verifiedRepoData.map(async (d) => {
      d.stargazersCount = await fetchStargazersCount(d.repoURL);
    }),
  );

  return {
    githubTrendingData: verifiedRepoData,
  };
}
