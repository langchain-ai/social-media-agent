import { Annotation } from "@langchain/langgraph";
import { Source } from "./types.js";
import { CuratedData } from "../curate-data/types.js";
import { GenerateReportAnnotation } from "../generate-report/state.js";

export const SupervisorAnnotation = Annotation.Root({
  /**
   * The final data object from ingesting all sources.
   */
  curatedData: Annotation<CuratedData>,
  /**
   * A list of reports, each containing a report & key details on a given data source/data group.
   * The report is used for generating a post, and key details are used for identifying reports on the same topic.
   */
  reports: GenerateReportAnnotation.spec.reports,
  /**
   * The list of reports after they have been grouped.
   */
  groupedReports: Annotation<
    Array<{
      reports: string[];
      keyDetails: string[];
    }>
  >,
  /**
   * The report and type of post to generate.
   */
  reportAndPostType: Annotation<
    Array<{
      reports: string[];
      keyDetails: string[];
      reason: string;
      type: "thread" | "post";
    }>
  >,
  /**
   * Thread and run IDs, along with the type of post to generate.
   */
  idsAndTypes: Annotation<
    Array<{
      type: "thread" | "post";
      thread_id: string;
      run_id: string;
    }>
  >({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
});

export const SupervisorConfigurableAnnotation = Annotation.Root({
  /**
   * The sources to ingest from.
   */
  sources: Annotation<Source[]>,
});

export type SupervisorState = typeof SupervisorAnnotation.State;
