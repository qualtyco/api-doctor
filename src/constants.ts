/** Oxlint plugin name — must match `meta.name` in src/plugin/index.ts */
export const PLUGIN_NAME = '@api-doctor/cli';

/**
 * Directory names never scanned: dependency/build output, tool caches, and
 * conventional test directories. Test code is skipped because findings there
 * are noise by design (deliberately-broken fixtures, mocked clients) 
 *
 * Used by both walks over a scanned project: the scanner's own walk
 * (detection, coverage, snippets) and oxlint's walk (findings, via
 * `ignorePatterns`). One list keeps the two views of the project identical.
 */
export const SKIP_DIR_NAMES = [
  'node_modules',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.venv',
  'venv',
  '.tox',
  '.mypy_cache',
  'test',
  'tests',
  '__tests__',
];
