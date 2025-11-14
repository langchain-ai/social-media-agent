import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { toZonedTime } from "date-fns-tz";
import { DateType } from "../../types.js";
import { timezoneToUtc } from "../../../utils/date.js";

const SCHEDULE_POST_DATE_PROMPT = `You're an intelligent AI assistant tasked with extracting the date to schedule a social media post from the user's message.

The user may respond with either:
1. A priority level (P1, P2, P3)
  - **P1**: Saturday/Sunday between 8:00 AM and 10:00 AM PST.
  - **P2**: Friday/Monday between 8:00 AM and 10:00 AM PST _OR_ Saturday/Sunday between 11:30 AM and 1:00 PM PST.
  - **P3**: Saturday/Sunday between 1:00 PM and 5:00 PM PST.
2. A date

Your task is to extract the date/priority level from the user's message and return it in a structured format the system can handle.

If the user's message is asking for a date, convert it to the following format:
'MM/dd/yyyy hh:mm a z'. Example: '12/25/2024 10:00 AM PST'
Always use PST for the timezone. If they don't specify a time, you can make one up, as long as it's between 8:00 AM and 3:00 PM PST (5 minute intervals).

If the user's message is asking for a priority level, return it in the following format:
'p1', 'p2', or 'p3'

The current date and time (in PST) are: {currentDateAndTime}

You should use this to infer the date if the user's message does not contain an exact date,
Example: 'this saturday'

If the user's message can not be interpreted as a date or priority level, return 'p3'.`;

const scheduleDateSchema = z.object({
  scheduleDate: z
    .string()
    .describe(
      "The date in the format 'MM/dd/yyyy hh:mm a z' or a priority level (p1, p2, p3).",
    ),
});

export async function updateScheduledDate(
  state: Record<string, any>,
): Promise<Record<string, any>> {
  if (!state.userResponse) {
    throw new Error("No user response found");
  }
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0.5,
  }).withStructuredOutput(scheduleDateSchema, {
    name: "scheduleDate",
  });
  const pstDate = toZonedTime(new Date(), "America/Los_Angeles");
  const pstDateString = pstDate.toISOString();

  const prompt = SCHEDULE_POST_DATE_PROMPT.replace(
    "{currentDateAndTime}",
    pstDateString,
  );

  const result = await model.invoke([
    {
      role: "system",
      content: prompt,
    },
    {
      role: "user",
      content: state.userResponse,
    },
  ]);

  if (
    typeof result.scheduleDate === "string" &&
    ["p1", "p2", "p3"].includes(result.scheduleDate)
  ) {
    return {
      scheduleDate: result.scheduleDate as DateType,
    };
  }

  return {
    next: undefined,
    userResponse: undefined,
    scheduleDate: timezoneToUtc(result.scheduleDate),
  };
}
