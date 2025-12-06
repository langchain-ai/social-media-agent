import { z } from "zod";
import { SupervisorState } from "../supervisor-state.js";
import { ChatVertexAI } from "@langchain/google-vertexai-web";

const IDENTIFY_SIMILAR_REPORTS_PROMPT = `You are an advanced AI assistant tasked with identifying similar reports based on key details.

You should first read the key details carefully, identify any possible reports which are on the same 'topic'. Here are some rules to use when identifying similar reports:
- The reports are similar if the details are on the same product, product release, or announcement.
- The reports are NOT similar if the details are on the same product, but a different release, announcement, or subject.


Given this, inspect each report carefully, then determine if it's similar enough to any other reports, which would warrant the reports being combined.

Your response should contain a list of objects, where each object contains an array of indices of the reports which are similar.
If a report is not similar to any other reports, you may omit it from the list.

Here are the key details from all of the reports:
<report-key-details>
{reportKeyDetails}
</report-key-details>`;

function formatReportKeyDetails(
  reports: Array<{ report: string; keyDetails: string }>,
) {
  return reports
    .map(
      (report, index) =>
        `<report index="${index}">\n${report.keyDetails}\n</report>`,
    )
    .join("\n");
}

const responseSchema = z
  .object({
    similarReports: z
      .array(
        z.object({
          indices: z
            .array(z.number())
            .describe(
              "A list of report indices which are similar enough to be grouped into one report.",
            ),
        }),
      )
      .describe(
        "A list of objects, each containing an array of indices of similar reports",
      ),
  })
  .describe(
    "A tool schema to call when grouping similar reports. Ensure this tool is ALWAYS CALLED NO MATTER WHAT.",
  );

function processGroupedReports(
  reports: Array<{ report: string; keyDetails: string }>,
  similarReports: { indices: number[] }[],
): Array<{ reports: string[]; keyDetails: string[] }> {
  // Create a Set to keep track of processed indices
  const processedIndices = new Set<number>();
  const result: Array<{ reports: string[]; keyDetails: string[] }> = [];

  // Process grouped reports first
  for (const group of similarReports) {
    if (!group.indices.length) {
      continue;
    }

    const reportGroup = {
      reports: group.indices.map((index) => {
        processedIndices.add(index);
        return reports[index].report;
      }),
      keyDetails: group.indices.map((index) => reports[index].keyDetails),
    };

    result.push(reportGroup);
  }

  // Add ungrouped reports as single-item groups
  for (let i = 0; i < reports.length; i++) {
    if (!processedIndices.has(i)) {
      result.push({
        reports: [reports[i].report],
        keyDetails: [reports[i].keyDetails],
      });
    }
  }

  return result;
}

export async function groupReports(
  state: SupervisorState,
): Promise<Partial<SupervisorState>> {
  const model = new ChatVertexAI({
    model: "gemini-2.5-pro",
    temperature: 0,
  }).withStructuredOutput(responseSchema, {
    name: "groupSimilarReports",
  });

  const formattedPrompt = IDENTIFY_SIMILAR_REPORTS_PROMPT.replace(
    "{reportKeyDetails}",
    formatReportKeyDetails(state.reports),
  );

  const result = await model.invoke([["user", formattedPrompt]]);

  const newReports = processGroupedReports(
    state.reports,
    result.similarReports,
  );

  return {
    groupedReports: newReports,
  };
}
