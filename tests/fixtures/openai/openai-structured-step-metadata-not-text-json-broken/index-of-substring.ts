// Distinct manifestation: indexOf + substring instead of lastIndexOf + slice.
export function extractStepMetadata(message: string) {
  const braceStart = message.indexOf('{');
  const braceEnd = message.lastIndexOf('}') + 1;
  if (braceStart === -1 || braceEnd === 0) return null;
  return JSON.parse(message.substring(braceStart, braceEnd));
}
