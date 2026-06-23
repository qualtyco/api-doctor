import type { ProviderManifest } from '../../types.js';

export const auth0Manifest: ProviderManifest = {
  name: 'auth0',
  displayName: 'Auth0',
  detect: {
    packages: ['jsonwebtoken', 'jwks-rsa', 'express-jwt'],
    imports: ['jsonwebtoken', 'jwks-rsa', 'express-jwt'],
    urlPatterns: ['auth0.com'],
  },
  oxlintRules: [
    {
      key: 'auth0-required-audience-validation',
      resultRule: 'auth0/security/required-audience-validation',
      message:
        'Auth0 JWT verification is configured without (or only conditionally with) audience validation.',
      fix: 'Require AUTH0_AUDIENCE and fail closed if it is unset, then always pass `audience` to jwt.verify()/express-jwt so a token issued for a different API cannot authenticate here.',
      docsUrl: 'https://auth0.com/docs/secure/tokens/json-web-tokens/validate-json-web-tokens',
      severity: 'error',
    },
    {
      key: 'auth0-no-account-link-without-verified-email',
      resultRule: 'auth0/security/no-account-link-without-verified-email',
      message:
        'Account lookup is keyed on an email claim without checking email_verified first.',
      fix: 'Require claims.email_verified (or the namespaced equivalent) before using the email claim to look up or re-link an existing account; otherwise create a new, unlinked account.',
      docsUrl: 'https://auth0.com/docs/manage-users/user-accounts/user-account-linking',
      severity: 'error',
    },
    {
      key: 'auth0-dead-claim-verification-check',
      resultRule: 'auth0/correctness/dead-claim-verification-check',
      message: 'Stringified boolean claim is checked with .includes() against a substring it can never contain.',
      fix: 'Compare the claim directly, e.g. `if (!claims.email_verified) { ... }`, instead of stringifying it and checking for a substring.',
      docsUrl: 'https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-token-claims',
      severity: 'error',
    },
    {
      key: 'auth0-jwks-refresh-on-unknown-kid',
      resultRule: 'auth0/reliability/jwks-refresh-on-unknown-kid',
      message: 'JWKS kid lookup has no retry-with-forced-refresh path on a cache miss.',
      fix: 'On a kid miss, force a fresh JWKS fetch and retry the lookup once before failing, instead of failing immediately against a possibly-stale cache.',
      docsUrl: 'https://auth0.com/docs/get-started/tenant-settings/signing-keys/rotate-signing-keys',
      severity: 'warning',
    },
  ],
};
