/**
 * Extracts a small window of source lines around an issue, preserving original
 * indentation. Shared by every output format that embeds code context.
 */
import type { CodeSnippet } from '../types.js';

/**
 * Returns up to `2 * contextLines + 1` lines centered on `line` (1-indexed).
 * Clamps to file bounds, so a short file returns only what's available.
 */
export function extractCodeSnippet(
  content: string,
  line: number,
  contextLines = 2,
): CodeSnippet {
  const allLines = content.split(/\r?\n/);
  // Clamp the highlighted line into the file's range.
  const highlighted = Math.min(Math.max(line, 1), allLines.length || 1);

  const start = Math.max(1, highlighted - contextLines);
  const end = Math.min(allLines.length, highlighted + contextLines);

  const lines: Array<{ number: number; text: string }> = [];
  for (let n = start; n <= end; n++) {
    lines.push({ number: n, text: allLines[n - 1] ?? '' });
  }

  return { lines, highlightedLine: highlighted };
}
