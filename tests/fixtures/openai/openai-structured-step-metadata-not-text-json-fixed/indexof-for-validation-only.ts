// Looks similar (indexOf('{') is present), but it's only used as a sanity
// check that the whole message is JSON-shaped — the parse target is the
// full, already-known-complete string, never a slice/substring of it.
export function validateAndParseStepPayload(rawJsonString: string) {
  if (rawJsonString.indexOf('{') !== 0) {
    throw new Error('Expected payload to start with a JSON object');
  }
  return JSON.parse(rawJsonString);
}
