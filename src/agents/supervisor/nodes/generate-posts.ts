import { Client } from "@langchain/langgraph-sdk";
import { SupervisorState } from "../supervisor-state.js";
import { extractUrls } from "../../utils.js";
import { SlackClient } from "../../../clients/slack/client.js";

export async function generatePosts(
  state: SupervisorState,
): Promise<Partial<SupervisorState>> {
  const client = new Client({
    apiUrl:
      process.env.LANGGRAPH_API_URL || `http://localhost:${process.env.PORT}`,
  });

  const idsAndTypes: Array<{
    type: "thread" | "post";
    thread_id: string;
    run_id: string;
  }> = [];

  for await (const reportAndPostType of state.reportAndPostType) {
    const { thread_id } = await client.threads.create();
    const reportsMapped = reportAndPostType.reports.map((report, index) => {
      if (!reportAndPostType.keyDetails[index]) {
        return report;
      }

      return `# Report Key Details:\n${reportAndPostType.keyDetails[index]}\n\n${report}`;
    });
    if (reportAndPostType.type === "thread") {
      const run = await client.runs.create(thread_id, "generate_thread", {
        input: {
          reports: reportsMapped,
        },
      });

      idsAndTypes.push({
        type: "thread",
        thread_id,
        run_id: run.run_id,
      });
    } else {
      const reportString = reportsMapped.join("\n");
      const linksInReport = extractUrls(reportString);
      const run = await client.runs.create(thread_id, "generate_post", {
        input: {},
        command: {
          goto: "generatePost",
          update: {
            report: reportString,
            links: [linksInReport?.[0] || ""],
            relevantLinks: [linksInReport?.[0] || ""],
          },
        },
      });

      idsAndTypes.push({
        type: "post",
        thread_id,
        run_id: run.run_id,
      });
    }
  }

  if (!process.env.SLACK_CHANNEL_ID || !process.env.SLACK_BOT_OAUTH_TOKEN) {
    return {};
  }

  const slackClient = new SlackClient();

  const messageText = `*Ingested data successfully processed*
  
Number of threads: *${idsAndTypes.filter((x) => x.type === "thread").length}*
Number of individual posts: *${idsAndTypes.filter((x) => x.type === "post").length}*

Thread post IDs:
${idsAndTypes
  .filter((x) => x.type === "thread")
  .map((x) => `- *${x.thread_id}* : *${x.run_id}*`)
  .join("\n")}
  
Single post IDs:
${idsAndTypes
  .filter((x) => x.type === "post")
  .map((x) => `- *${x.thread_id}* : *${x.run_id}*`)
  .join("\n")}`;

  await slackClient.sendMessage(process.env.SLACK_CHANNEL_ID, messageText);

  return {
    idsAndTypes,
  };
}
