export function extractStepMetadata(toolCall: { function: { arguments: string } }) {
  // arguments is a complete, schema-validated string from the report_step
  // function tool — no text-scraping needed.
  return JSON.parse(toolCall.function.arguments);
}
