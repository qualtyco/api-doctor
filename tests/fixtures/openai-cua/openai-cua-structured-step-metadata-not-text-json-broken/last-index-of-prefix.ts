export function parseStepJsonFromText(raw: string): { simplified: string; thought: string } | null {
  const start = raw.lastIndexOf('{"simplified":');
  if (start === -1) return null;
  const end = raw.length;
  try {
    return JSON.parse(raw.slice(start, end));
  } catch {
    return null;
  }
}
