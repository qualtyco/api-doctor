// The auth0 provider is currently detected via its JWT-verification stack
// (jsonwebtoken / jwks-rsa / express-jwt), not the `auth0` package itself.
// This import keeps detection sourced from `imports` rather than
// `url-patterns`, so coverage collection runs for this fixture.
import jwt from 'jsonwebtoken';

export function decodeForDebug(token: string) {
  return jwt.decode(token, { complete: true });
}
