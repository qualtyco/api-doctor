/**
 * CLI entry point: parses arguments with commander, runs scan + report,
 * exits 1 when errors are found (for CI), 0 otherwise.
 */
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { providers } from './providers/index.js';
import { countErrors, report } from './reporter.js';
import { scan } from './scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
) as { version: string };

const program = new Command();

program
  .name('api-doctor')
  .description('Verification rules for AI-generated API integrations')
  .version(pkg.version)
  .argument('[directory]', 'Project directory to scan', '.')
  .option('--verbose', 'Show file paths for each issue')
  .option('--provider <names>', 'Comma-separated providers to scan (e.g. resend)')
  .option('--list-providers', 'List supported API providers')
  .action(async (directory: string, opts: { verbose?: boolean; provider?: string; listProviders?: boolean }) => {
    if (opts.listProviders) {
      for (const p of providers) {
        console.log(`${p.name} — ${p.displayName}`);
      }
      process.exit(0);
    }

    const onlyProviders = opts.provider
      ? opts.provider.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    
    // Start time of when workflow runs
    const start = performance.now();

    // await scan function to detect providers in connected codebase
    const { results, detected } = await scan(directory, { onlyProviders });
    
    // Returns report of api-doctor
    report(results, detected, {
      verbose: opts.verbose,
      elapsedMs: performance.now() - start,
    });

    const errors = countErrors(results);
    process.exit(errors > 0 ? 1 : 0);
  });

program.parse();
