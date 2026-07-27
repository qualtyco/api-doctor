/**
 * Per-file language classification for the dual JS/Python scan pipeline.
 */
import type { RuleLanguage } from '../types.js';

const JS_EXT = /\.(tsx?|jsx?)$/;
const PY_EXT = /\.py$/;

/** Returns the analysis language for a file path, or null if unsupported. */
export function classifyFileLanguage(filePath: string): RuleLanguage | null {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  if (JS_EXT.test(base)) return 'javascript';
  if (PY_EXT.test(base)) return 'python';
  return null;
}

export function isJavascriptFile(filePath: string): boolean {
  return classifyFileLanguage(filePath) === 'javascript';
}

export function isPythonFile(filePath: string): boolean {
  return classifyFileLanguage(filePath) === 'python';
}
