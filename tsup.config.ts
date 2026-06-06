/**
 * Bundles the CLI and oxlint plugin from a single package.
 */
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli.ts'],
    format: ['cjs', 'esm'],
    outExtension({ format }) {
      return { js: format === 'cjs' ? '.cjs' : '.mjs' };
    },
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    shims: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: { plugin: 'src/plugin/index.ts' },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    shims: true,
  },
]);
