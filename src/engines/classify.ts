/**
 * Per-file language classification for the dual JS/Python scan pipeline.
 */
import type { RuleLanguage } from '../types.js';

const JS_EXT = /\.(tsx?|jsx?)$/;
// PYTHON-DORMANT: const PY_EXT = /\.py$/;

/**
 * Returns the analysis language for a file path, or null if unsupported.
 *
 * PYTHON-DORMANT: this is the master kill switch for the Python engine. While
 * the `.py` branch stays commented out this function never returns 'python',
 * so `.py` files are not walked, not read, not classified, and never reach an
 * engine. Re-enable it (with the other PYTHON-DORMANT sites) when the Python
 * rule pack ships. Run `grep -rn PYTHON-DORMANT src tests` to find them all.
 */
export function classifyFileLanguage(filePath: string): RuleLanguage | null {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  if (JS_EXT.test(base)) return 'javascript';
  // PYTHON-DORMANT: if (PY_EXT.test(base)) return 'python';
  return null;
}

export function isJavascriptFile(filePath: string): boolean {
  return classifyFileLanguage(filePath) === 'javascript';
}

export function isPythonFile(filePath: string): boolean {
  return classifyFileLanguage(filePath) === 'python';
}
