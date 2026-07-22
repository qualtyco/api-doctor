import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Build once before any test workers start. The scanner and CLI tests both load
 * the bundled plugin from `dist/`, so building inside individual test files
 * would race the tsup clean step against parallel oxlint runs.
 */
export default function setup(): void {
  const build = spawnSync('npm', ['run', 'build'], { cwd: repoRoot, encoding: 'utf8' });
  if (build.status !== 0) {
    throw new Error(`api-doctor build failed before tests:\n${build.stderr}`);
  }
}
