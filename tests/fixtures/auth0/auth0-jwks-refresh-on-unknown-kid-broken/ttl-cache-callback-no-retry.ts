const JWKS_CACHE_TTL = 24 * 60 * 60 * 1000;
let jwksCache: any = null;
let jwksCacheTime = 0;

async function getJwks(domain: string) {
  if (jwksCache && Date.now() - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache;
  }
  const resp = await fetch(`https://${domain}/.well-known/jwks.json`);
  jwksCache = await resp.json();
  jwksCacheTime = Date.now();
  return jwksCache;
}

// Only ever calls getJwks() once per lookup — a kid miss against a stale
// cache fails immediately instead of forcing a fresh fetch and retrying.
export function getKey(domain: string, header: any, callback: any) {
  getJwks(domain).then((jwks) => {
    const key = jwks.keys.find((k: any) => k.kid === header.kid);
    if (!key) {
      callback(new Error('Invalid JSON Web Key Set'));
      return;
    }
    callback(null, key);
  });
}
