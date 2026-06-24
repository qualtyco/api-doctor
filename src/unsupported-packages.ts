import { providers } from './providers/index.js';

/** Common packages that are not useful for provider discovery prompts. */
export const EXCLUDED_PACKAGES = new Set([
  // React ecosystem
  'react',
  'react-dom',
  'react-bootstrap',
  'react-day-picker',
  'react-hook-form',
  'react-resizable-panels',
  'react-router',
  'react-router-dom',
  // Build tools
  'vite',
  'vitest',
  'typescript',
  'typescript-eslint',
  '@vitejs/plugin-react',
  '@vitejs/plugin-react-swc',
  // Linting
  'eslint',
  '@eslint/js',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react-refresh',
  'globals',
  // CSS & styling
  'bootstrap',
  'tailwindcss',
  'tailwindcss-animate',
  'tailwind-merge',
  '@tailwindcss/typography',
  'postcss',
  'autoprefixer',
  'class-variance-authority',
  'clsx',
  'next-themes',
  // UI libraries
  '@radix-ui/react-accordion',
  '@radix-ui/react-alert-dialog',
  '@radix-ui/react-aspect-ratio',
  '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-collapsible',
  '@radix-ui/react-context-menu',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-hover-card',
  '@radix-ui/react-label',
  '@radix-ui/react-menubar',
  '@radix-ui/react-navigation-menu',
  '@radix-ui/react-popover',
  '@radix-ui/react-progress',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-slider',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-toast',
  '@radix-ui/react-toggle',
  '@radix-ui/react-toggle-group',
  '@radix-ui/react-tooltip',
  'cmdk',
  'embla-carousel-react',
  'input-otp',
  'lucide-react',
  'recharts',
  'sonner',
  'vaul',
  // Data fetching & forms
  '@hookform/resolvers',
  '@tanstack/react-query',
  'zod',
  'date-fns',
  // Testing
  '@testing-library/jest-dom',
  '@testing-library/react',
  'jsdom',
  // Supported providers (common enough to skip the request-support prompt)
  'firebase',
  '@supabase/supabase-js',
  // Misc dev tools
  'pdfjs-dist',
  'lovable-tagger',
  '@anthropic-ai/claude-code',
  '@api-doctor/cli',
]);

const EXCLUDED_PREFIXES = ['@types/', '@radix-ui/', '@testing-library/'];

const SUPPORTED_PACKAGES = new Set(
  providers.flatMap((p) => [...(p.detect.packages ?? []), p.name]),
);

/** package.json deps that are not a supported provider and not excluded noise. */
export function getUnsupportedPackages(rawPackages: string[]): string[] {
  return rawPackages.filter(
    (p) =>
      !EXCLUDED_PACKAGES.has(p) &&
      !SUPPORTED_PACKAGES.has(p) &&
      !EXCLUDED_PREFIXES.some((prefix) => p.startsWith(prefix)),
  );
}
