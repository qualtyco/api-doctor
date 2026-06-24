import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { DetectedProvider, ScanResult } from './types.js';
import { readProjectHistory, writeProjectHistory } from './run-history.js';

// Public project API key — safe to embed (same as a browser-side PostHog key).
const POSTHOG_API_KEY = 'phc_odgcBBsio9P5XJ3zT3Hyd6pgawQXW6YvwgJUejUTWhxz';
const POSTHOG_CAPTURE_URL = 'https://us.i.posthog.com/capture/';

// install-id stays global (per-user); run history moves to each project dir.
const INSTALL_ID_PATH = join(homedir(), '.api-doctor', 'install-id');

/**
 * Packages excluded from package_seen telemetry — these are utility/framework/dev-tool
 * packages that tell us nothing about what API providers to build next.
 * Anything NOT on this list fires a package_seen event, so new or emerging SDKs
 * are captured automatically without needing to maintain a whitelist.
 *
 * Derived from audited sample projects + common npm ecosystem knowledge.
 */
const EXCLUDED_PACKAGES = new Set([
  // React ecosystem
  'react', 'react-dom', 'react-router', 'react-router-dom', 'react-is',
  'react-refresh', 'react-hook-form', 'react-day-picker', 'react-resizable-panels',
  'react-bootstrap', 'react-error-boundary',
  // Meta-frameworks
  'next', 'nuxt', 'gatsby', 'remix', '@remix-run/node', '@remix-run/react',
  'astro', '@sveltejs/kit', 'vitepress', 'vuepress',
  // Build tools
  'vite', 'webpack', 'rollup', 'esbuild', 'parcel', 'turbo', 'tsup',
  '@vitejs/plugin-react', '@vitejs/plugin-react-swc', '@vitejs/plugin-vue',
  'create-react-app', 'react-scripts',
  // TypeScript
  'typescript', 'ts-node', 'tsx',
  // Type stubs — entire @types/* namespace handled via prefix check in code
  // CSS & styling
  'bootstrap', 'tailwindcss', 'postcss', 'autoprefixer', '@tailwindcss/typography',
  '@tailwindcss/forms', '@tailwindcss/aspect-ratio', 'tailwind-merge',
  'tailwindcss-animate', 'class-variance-authority', 'clsx', 'classnames',
  'styled-components', '@emotion/react', '@emotion/styled', 'sass', 'less',
  // UI component libraries
  '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-aspect-ratio',
  '@radix-ui/react-avatar', '@radix-ui/react-checkbox', '@radix-ui/react-collapsible',
  '@radix-ui/react-context-menu', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-hover-card', '@radix-ui/react-label', '@radix-ui/react-menubar',
  '@radix-ui/react-navigation-menu', '@radix-ui/react-popover', '@radix-ui/react-progress',
  '@radix-ui/react-radio-group', '@radix-ui/react-scroll-area', '@radix-ui/react-select',
  '@radix-ui/react-separator', '@radix-ui/react-slider', '@radix-ui/react-slot',
  '@radix-ui/react-switch', '@radix-ui/react-tabs', '@radix-ui/react-toast',
  '@radix-ui/react-toggle', '@radix-ui/react-toggle-group', '@radix-ui/react-tooltip',
  '@headlessui/react', '@headlessui/vue', 'shadcn', 'daisyui',
  'lucide-react', 'react-icons', '@heroicons/react', 'phosphor-react',
  'recharts', 'chart.js', 'react-chartjs-2', 'd3', 'd3-selection',
  'embla-carousel-react', 'swiper', 'keen-slider',
  'vaul', 'sonner', 'cmdk', 'next-themes', 'framer-motion',
  'react-spring', 'react-transition-group', 'react-resizable-panels',
  // Form & validation
  '@hookform/resolvers', 'zod', 'yup', 'joi', 'formik', 'vee-validate',
  'input-otp', 'react-number-format',
  // State management
  'zustand', 'jotai', 'recoil', 'redux', '@reduxjs/toolkit', 'react-redux',
  'mobx', 'mobx-react', 'xstate', 'valtio', 'nanostores',
  // Data fetching & query
  '@tanstack/react-query', '@tanstack/vue-query', 'swr', 'axios',
  // Date & time utils
  'date-fns', 'dayjs', 'moment', 'luxon', 'temporal-polyfill',
  // General utilities
  'lodash', 'lodash-es', 'underscore', 'ramda', 'immer', 'uuid', 'nanoid',
  'classnames', 'clsx', 'dotenv', 'cross-env', 'env-cmd',
  // Testing
  'vitest', 'jest', 'mocha', 'jasmine', 'ava', 'tap',
  '@testing-library/react', '@testing-library/vue', '@testing-library/jest-dom',
  '@testing-library/user-event', 'jsdom', 'happy-dom',
  'cypress', 'playwright', '@playwright/test', 'puppeteer',
  // Linting & formatting
  'eslint', 'prettier', 'oxlint', 'biome',
  '@eslint/js', 'eslint-plugin-react', 'eslint-plugin-react-hooks',
  'eslint-plugin-react-refresh', 'eslint-plugin-import', 'eslint-config-prettier',
  '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'typescript-eslint',
  'globals', 'husky', 'lint-staged',
  // PDF & file processing
  'pdfjs-dist', 'pdf-lib', 'xlsx', 'csv-parse', 'papaparse',
  // Misc dev tools
  'concurrently', 'nodemon', 'chokidar', 'rimraf', 'npm-run-all',
  'lovable-tagger',
  '@anthropic-ai/claude-code', // Anthropic's own CLI, not an API client
  '@api-doctor/cli', // ourselves
]);

function isTelemetryDisabled(noTelemetry: boolean): boolean {
  if (noTelemetry) return true;
  if (process.env['DO_NOT_TRACK'] === '1') return true;
  if (process.env['API_DOCTOR_TELEMETRY'] === '0') return true;
  return false;
}

function getOrCreateInstallId(): string {
  try {
    mkdirSync(join(homedir(), '.api-doctor'), { recursive: true });
    if (existsSync(INSTALL_ID_PATH)) {
      return readFileSync(INSTALL_ID_PATH, 'utf-8').trim();
    }
    const id = randomUUID();
    writeFileSync(INSTALL_ID_PATH, id, 'utf-8');
    return id;
  } catch {
    return 'anonymous';
  }
}

function detectRunContext(): string {
  if (process.env['CI']) return 'ci';
  if (
    process.env['CLAUDE_CODE'] ||
    process.env['CURSOR_TRACE_ID'] ||
    process.env['CODEX_ENV'] ||
    process.env['WINDSURF_SESSION_ID']
  )
    return 'agent';
  return 'local';
}

async function capture(event: string, distinctId: string, properties: Record<string, unknown>): Promise<void> {
  await fetch(POSTHOG_CAPTURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_API_KEY, event, distinct_id: distinctId, properties }),
  });
}

export interface TrackRunOptions {
  version: string;
  results: ScanResult[];
  detected: DetectedProvider[];
  rawPackages: string[];
  score: number;
  durationMs: number;
  noTelemetry: boolean;
  projectDir: string;
}

export async function trackRun(opts: TrackRunOptions): Promise<void> {
  if (isTelemetryDisabled(opts.noTelemetry)) return;

  try {
    const distinctId = getOrCreateInstallId();
    const prev = readProjectHistory(opts.projectDir);
    const scoreDelta = prev !== null ? opts.score - prev.last_score : null;

    const sharedProps = {
      cli_version: opts.version,
      node_version: process.version,
      platform: process.platform,
      run_context: detectRunContext(),
    };

    // Count how many times each rule fired and whether it produced errors.
    const rulesFiredCounts: Record<string, number> = {};
    for (const r of opts.results) {
      rulesFiredCounts[r.ruleKey] = (rulesFiredCounts[r.ruleKey] ?? 0) + 1;
    }

    // 1. One summary event per scan.
    await capture('cli_run', distinctId, {
      ...sharedProps,
      providers_detected: opts.detected.map((d) => d.name),
      rules_fired_counts: rulesFiredCounts,
      score: opts.score,
      score_delta: scoreDelta,
      errors: opts.results.filter((r) => r.severity === 'error').length,
      warnings: opts.results.filter((r) => r.severity === 'warning').length,
      duration_ms: Math.round(opts.durationMs),
      run_count: (prev?.run_count ?? 0) + 1,
    });

    // 2. One event per supported provider found — tells you which provider is scanned most.
    // Bounded by the number of providers we support (~7), never explodes.
    await Promise.all(
      opts.detected.map((d) =>
        capture('provider_scanned', distinctId, {
          ...sharedProps,
          provider: d.name,
          score: opts.score,
        }),
      ),
    );

    // 3. One event per package not in the exclusion list and not already a supported provider.
    // Captures any API/SDK regardless of whether we've seen it before — new tech included.
    // @types/*, @radix-ui/*, and other noisy namespaces are excluded by prefix.
    const supportedNames = new Set(opts.detected.map((d) => d.name));
    const EXCLUDED_PREFIXES = ['@types/', '@radix-ui/', '@testing-library/', '@eslint/'];
    const unseenPackages = opts.rawPackages.filter(
      (p) =>
        !EXCLUDED_PACKAGES.has(p) &&
        !supportedNames.has(p) &&
        !EXCLUDED_PREFIXES.some((prefix) => p.startsWith(prefix)),
    );
    await Promise.all(
      unseenPackages.map((pkg) =>
        capture('package_seen', distinctId, { ...sharedProps, package: pkg }),
      ),
    );

    writeProjectHistory(opts.projectDir, {
      last_score: opts.score,
      last_run: new Date().toISOString(),
      run_count: (prev?.run_count ?? 0) + 1,
    });
  } catch {
    // Never surface telemetry errors to the user.
  }
}

export interface TrackInstallOptions {
  version: string;
  filesCreated: number;
  filesUpdated: number;
  filesSkipped: number;
  force: boolean;
  noTelemetry: boolean;
}

export async function trackInstall(opts: TrackInstallOptions): Promise<void> {
  if (isTelemetryDisabled(opts.noTelemetry)) return;

  try {
    const distinctId = getOrCreateInstallId();
    await capture('install_command_run', distinctId, {
      cli_version: opts.version,
      node_version: process.version,
      platform: process.platform,
      files_created: opts.filesCreated,
      files_updated: opts.filesUpdated,
      files_skipped: opts.filesSkipped,
      force: opts.force,
    });
  } catch {
    // Never surface telemetry errors to the user.
  }
}

export async function trackError(err: unknown, noTelemetry: boolean, version: string): Promise<void> {
  if (isTelemetryDisabled(noTelemetry)) return;

  try {
    const distinctId = getOrCreateInstallId();
    await capture('cli_error', distinctId, {
      cli_version: version,
      node_version: process.version,
      platform: process.platform,
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
  } catch {
    // Never surface telemetry errors to the user.
  }
}
