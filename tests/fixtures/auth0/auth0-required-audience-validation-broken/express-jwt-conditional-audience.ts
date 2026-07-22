import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

const domain = process.env.AUTH0_DOMAIN;

// Audience is only added if AUTH0_AUDIENCE happens to be set — unset it in
// any environment and the spread contributes nothing, so the check vanishes
// instead of failing closed.
export const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksUri: `https://${domain}/.well-known/jwks.json`,
  }),
  issuer: `https://${domain}/`,
  algorithms: ['RS256'],
  ...(process.env.AUTH0_AUDIENCE ? { audience: process.env.AUTH0_AUDIENCE } : {}),
});
