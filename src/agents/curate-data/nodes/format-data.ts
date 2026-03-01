import { CurateDataState } from "../state.js";
import { TweetsGroupedByContent } from "../types.js";

function getTweetGroupEngagement(group: TweetsGroupedByContent): number {
  return group.tweets.reduce((sum, tweet) => {
    const m = tweet.public_metrics;
    if (!m) return sum;
    return sum + m.like_count + m.retweet_count + m.reply_count + m.quote_count;
  }, 0);
}

export async function formatData(
  state: CurateDataState,
): Promise<Partial<CurateDataState>> {
  const sortedTweetGroups = state.tweetsGroupedByContent
    ? [...state.tweetsGroupedByContent].sort(
        (a, b) => getTweetGroupEngagement(b) - getTweetGroupEngagement(a),
      )
    : undefined;

  const sortedRedditPosts = state.redditPosts
    ? [...state.redditPosts].sort(
        (a, b) => (b.post.score ?? 0) - (a.post.score ?? 0),
      )
    : undefined;

  const sortedGithubData = state.githubTrendingData
    ? [...state.githubTrendingData].sort(
        (a, b) => (b.stargazersCount ?? 0) - (a.stargazersCount ?? 0),
      )
    : undefined;

  return {
    curatedData: {
      tweetsGroupedByContent: sortedTweetGroups,
      redditPosts: sortedRedditPosts,
      generalContents: state.pageContents?.map((pc, idx) => ({
        pageContent: pc,
        relevantLinks: (state.relevantLinks?.[idx] || []) as string[],
      })),
      githubTrendingData: sortedGithubData,
    },
  };
}
