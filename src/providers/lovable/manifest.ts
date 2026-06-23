import type { ProviderManifest } from '../../types.js';

export const lovableManifest: ProviderManifest = {
  name: 'lovable',
  displayName: 'Lovable',
  detect: {
    packages: ['lovable-tagger'],
    imports: ['lovable-tagger'],
    urlPatterns: ['lovable.dev', 'lovable.app'],
  },
  oxlintRules: [
    {
      key: 'lovable-no-client-side-secret-fetch',
      resultRule: 'lovable/security/no-client-side-secret-fetch',
      message:
        'A third-party LLM provider is called directly from client code with a key read from import.meta.env.VITE_*, which ships into the browser bundle.',
      fix: 'Move this call into a Lovable Cloud Edge Function and keep the provider key in Secrets — the browser should call your own Edge Function, never the provider directly.',
      docsUrl: 'https://docs.lovable.dev/features/security',
      severity: 'error',
    },
    {
      key: 'lovable-paid-flag-without-edge-function',
      resultRule: 'lovable/security/paid-flag-without-edge-function',
      message:
        'A paid-looking flag is set via a direct database update with no payment-provider or Edge Function call.',
      fix: 'Move the purchase behind an Edge Function that creates a payment-provider checkout session, and only flip the flag from a server-side webhook after payment is confirmed.',
      docsUrl: 'https://docs.lovable.dev/features/cloud',
      severity: 'error',
    },
    {
      key: 'lovable-expiry-column-never-checked',
      resultRule: 'lovable/correctness/expiry-column-never-checked',
      message: 'An expiry column is written but never compared against the current time anywhere in this file.',
      fix: 'Filter or sort by the expiry column against the current time, or add a scheduled Edge Function / pg_cron job that clears the flag once it passes.',
      docsUrl: 'https://docs.lovable.dev/features/cloud',
      severity: 'warning',
    },
    {
      key: 'lovable-silent-catch-on-provider-call',
      resultRule: 'lovable/correctness/silent-catch-on-provider-call',
      message: 'A catch block around an LLM provider call has no logging, so failures look like "no key configured."',
      fix: 'console.error (or log to your error tracker) the failure reason — status code and error body — before falling through.',
      docsUrl: 'https://docs.lovable.dev/features/cloud',
      severity: 'warning',
    },
  ],
};
