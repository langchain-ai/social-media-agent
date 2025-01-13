import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import { DEFAULT_TAKEN_DATES, SCHEDULE_DATES_KEY, SCHEDULE_DATES_NAMESPACE, TAKEN_DATES_KEY, type TakenScheduleDates } from "../../src/agents/generate-post/nodes/schedule-post/find-date.js";

/**
 * Clear the store of old scheduled dates. Runs daily at 1AM PST
 * and deletes all scheduled dates older than 2 days.
 */
async function clearOldScheduledDates() {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
    // apiUrl: "http://localhost:54367",
  });
  
  const takenDates: TakenScheduleDates = (await client.store.getItem(SCHEDULE_DATES_NAMESPACE, SCHEDULE_DATES_KEY))?.value?.[TAKEN_DATES_KEY] || DEFAULT_TAKEN_DATES;

  takenDates.p1 = takenDates.p1.filter((date: Date) => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return new Date(date) > twoDaysAgo;
  });
  takenDates.p2 = takenDates.p2.filter((date: Date) => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return new Date(date) > twoDaysAgo;
  });
  takenDates.p3 = takenDates.p3.filter((date: Date) => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return new Date(date) > twoDaysAgo;
  });

  await client.store.putItem(SCHEDULE_DATES_NAMESPACE, SCHEDULE_DATES_KEY, {
    [TAKEN_DATES_KEY]: takenDates
  });
}

async function createCron() {
  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
    // apiUrl: "http://localhost:54367",
  });

  const res = await client.crons.create("clear_old_scheduled_dates", {
    schedule: "0 1 * * *",
    config: {
      configurable: {
        slackChannelId: "ADD_SLACK_CHANNEL_ID_HERE",
      },
    },
  });
  console.log(res);
}