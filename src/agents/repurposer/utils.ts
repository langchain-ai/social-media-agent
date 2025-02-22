export function formatReportForPrompt(report: {
  report: string;
  keyDetails: string;
}): string {
  return `<key-details>\n${report.keyDetails}\n</key-details>\n\n<report>\n${report.report}\n</report>`;
}
