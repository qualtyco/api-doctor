import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

const domain = process.env.AUTH0_DOMAIN;
const audience = process.env.AUTH0_AUDIENCE;

// Looks similar to an env-var-derived audience (which is what the broken
// fixtures use too), but this fails closed at startup instead of silently
// disabling the check — so the `audience` key is always present and always
// a real value by the time it reaches the middleware config below.
if (!audience) {
  throw new Error('AUTH0_AUDIENCE must be set');
}

export const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksUri: `https://${domain}/.well-known/jwks.json`,
  }),
  issuer: `https://${domain}/`,
  algorithms: ['RS256'],
  audience,
});
