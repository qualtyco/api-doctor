import type { ProviderManifest } from '../../types.js';

/** Detection-only for now — rules not implemented yet. */
export const stripeManifest: ProviderManifest = {
  name: 'stripe',
  displayName: 'Stripe',
  detect: {
    packages: ['stripe', '@stripe/stripe-js'],
    imports: ['stripe', '@stripe/stripe-js'],
    urlPatterns: ['api.stripe.com'],
  },
  oxlintRules: [],
};
