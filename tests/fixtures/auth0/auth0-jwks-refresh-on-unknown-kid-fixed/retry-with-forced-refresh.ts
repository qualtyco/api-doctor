const JWKS_CACHE_TTL = 24 * 60 * 60 * 1000;
let jwksCache: any = null;
let jwksCacheTime = 0;

async function getJwks(domain: string, options?: { forceRefresh?: boolean }) {
  if (!options?.forceRefresh && jwksCache && Date.now() - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache;
  }
  const resp = await fetch(`https://${domain}/.well-known/jwks.json`);
  jwksCache = await resp.json();
  jwksCacheTime = Date.now();
  return jwksCache;
}

export async function resolveSigningKey(domain: string, kid: string) {
  let jwks = await getJwks(domain);
  let match = jwks.keys.find((k: any) => k.kid === kid);
  if (!match) {
    jwks = await getJwks(domain, { forceRefresh: true });
    match = jwks.keys.find((k: any) => k.kid === kid);
  }
  if (!match) {
    throw new Error('Invalid JSON Web Key Set');
  }
  return match;
}
