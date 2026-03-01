import { BaseStore } from "@langchain/langgraph";
import { getGitHubRepoURLs } from "../../utils/stores/github-repos.js";
import { Octokit } from "@octokit/rest";
import { traceable } from "langsmith/traceable";

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  return new Octokit({ auth: token });
}

const SEARCH_CONFIG = {
  terms: ["langgraph", "langchain"],
  deepagentsTerm: "deepagents",
  excludeOrg: "-org:langchain-ai",
  maxAgeDays: 30,
};

const LIMITS = {
  newRepos: 40,
  popularRepos: 15,
  deepagents: 10,
};

function getSinceDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - SEARCH_CONFIG.maxAgeDays);
  return d.toISOString().split("T")[0];
}

async function searchRepos(
  octokit: Octokit,
  queries: string[],
  seen: Set<string>,
  limit: number,
): Promise<string[]> {
  const results: string[] = [];

  for (const q of queries) {
    if (results.length >= limit) break;

    try {
      const { data } = await octokit.search.repos({
        q,
        sort: "stars",
        order: "desc",
        per_page: 30,
      });

      for (const repo of data.items) {
        if (results.length >= limit) break;
        if (seen.has(repo.html_url)) continue;

        seen.add(repo.html_url);
        results.push(repo.html_url);
      }
    } catch (error) {
      console.error(`Failed to search repos for query "${q}":`, error);
    }
  }

  return results;
}

async function langchainDependencyReposLoaderFunc(
  store: BaseStore | undefined,
) {
  const octokit = getOctokit();
  const processedRepos = await getGitHubRepoURLs(store);
  const since = getSinceDate();
  const seen = new Set<string>(processedRepos);

  const { terms, deepagentsTerm, excludeOrg } = SEARCH_CONFIG;

  const newRepoQueries = terms.map(
    (term) => `${term} created:>${since} ${excludeOrg} stars:>10`,
  );

  const popularRepoQueries = terms.map(
    (term) => `${term} pushed:>${since} ${excludeOrg} stars:>20`,
  );

  const deepagentsQueries = [
    `${deepagentsTerm} created:>${since} ${excludeOrg} stars:>5`,
    `${deepagentsTerm} pushed:>${since} ${excludeOrg} stars:>20`,
  ];

  const [newRepos, popularRepos, deepagentsRepos] = await Promise.all([
    searchRepos(octokit, newRepoQueries, new Set(seen), LIMITS.newRepos),
    searchRepos(
      octokit,
      popularRepoQueries,
      new Set(seen),
      LIMITS.popularRepos,
    ),
    searchRepos(octokit, deepagentsQueries, new Set(seen), LIMITS.deepagents),
  ]);

  return [...newRepos, ...deepagentsRepos, ...popularRepos];
}

export const langchainDependencyReposLoader = traceable(
  langchainDependencyReposLoaderFunc,
  { name: "github-loader-langchain" },
);
