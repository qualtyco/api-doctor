/**
 * Per-file language classification for the scan pipeline.
 */
import type { RuleLanguage } from '../types.js';

const JS_EXT = /\.(tsx?|jsx?)$/;

/**
 * Returns the analysis language for a file path, or null if unsupported.
 */
export function classifyFileLanguage(filePath: string): RuleLanguage | null {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  if (JS_EXT.test(base)) return 'javascript';
  return null;
}

export function isJavascriptFile(filePath: string): boolean {
  return classifyFileLanguage(filePath) === 'javascript';
}
