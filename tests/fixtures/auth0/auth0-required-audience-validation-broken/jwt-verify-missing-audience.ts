import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const domain = process.env.AUTH0_DOMAIN;
const client = jwksClient({ jwksUri: `https://${domain}/.well-known/jwks.json` });

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    callback(err, key?.getPublicKey());
  });
}

// No `audience` key at all — any token signed by this Auth0 tenant passes,
// regardless of which API it was actually issued for.
export function verifyAuth0Token(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: `https://${domain}/`,
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      },
    );
  });
}
