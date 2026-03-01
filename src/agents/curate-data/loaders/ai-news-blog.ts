import { traceable } from "langsmith/traceable";
import { parseStringPromise } from "xml2js";

const AI_NEWS_BLOG_RSS_URL = "https://news.smol.ai/rss.xml";

interface RSSItem {
  title: string[];
  link: string[];
  pubDate: string[];
  guid: string[];
}

interface RSSFeed {
  rss: {
    channel: [
      {
        item: RSSItem[];
      },
    ];
  };
}

/**
 * Loads the latest posts from the AI News Blog RSS feed.
 *
 * @returns {Promise<string[]>} Array of links
 */
async function aiNewsBlogLoaderFunc(): Promise<string[]> {
  const lastCheckTime = new Date(new Date().getTime() - 96 * 60 * 60 * 1000); // 96 hours ago

  try {
    // Fetch the RSS feed
    const response = await fetch(AI_NEWS_BLOG_RSS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    // Get the text content
    const xmlContent = await response.text();
    // Parse the XML content
    const parsedFeed = (await parseStringPromise(xmlContent)) as RSSFeed;

    // Get all items from the feed
    const items = parsedFeed.rss.channel[0].item;

    // Filter for only new items
    const filteredItems = items.filter((item) => {
      const pubDate = new Date(item.pubDate[0]);
      return pubDate > lastCheckTime;
    });

    // Return array of links
    return filteredItems.map((item) => item.link[0]);
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    throw error;
  }
}

export const aiNewsBlogLoader = traceable(aiNewsBlogLoaderFunc, {
  name: "ai-news-loader",
});
