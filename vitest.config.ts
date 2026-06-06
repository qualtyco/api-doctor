import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only collect real test files. Fixtures may be named like `*.test.ts`
    // (to exercise test-file detection) and must not be run as tests.
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/fixtures/**', 'node_modules/**', 'dist/**'],
  },
});
