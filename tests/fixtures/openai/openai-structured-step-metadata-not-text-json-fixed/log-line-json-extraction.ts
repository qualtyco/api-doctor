import { readFile } from 'node:fs/promises';
import OpenAI from 'openai';

// False-positive regression (audit: 27/27 FPs): indexOf('{') + slice +
// JSON.parse is the universal "extract JSON from a string" idiom. Here the
// file uses the OpenAI SDK (so file-level provider gating passes), but the
// sliced string is a log line read from disk — it does not trace to a CUA
// response, so the rule must not fire.
export const openai = new OpenAI();

export async function extractPayloadFromLogLine(logPath: string) {
  const contents = await readFile(logPath, 'utf8');
  const lastLine = contents.trimEnd().split('\n').pop() ?? '';
  const braceStart = lastLine.indexOf('{');
  if (braceStart === -1) return null;
  return JSON.parse(lastLine.slice(braceStart));
}
