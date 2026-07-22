import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const domain = process.env.AUTH0_DOMAIN;
const audience = process.env.AUTH0_AUDIENCE;
const client = jwksClient({ jwksUri: `https://${domain}/.well-known/jwks.json` });

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    callback(err, key?.getPublicKey());
  });
}

export function verifyAuth0Token(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: `https://${domain}/`,
        audience,
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      },
    );
  });
}
