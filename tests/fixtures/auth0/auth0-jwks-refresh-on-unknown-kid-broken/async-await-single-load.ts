let cachedJwks: any = null;
let cachedAt = 0;
const TTL_MS = 60 * 60 * 1000;

async function loadJwks(domain: string) {
  if (cachedJwks && Date.now() - cachedAt < TTL_MS) return cachedJwks;
  const resp = await fetch(`https://${domain}/.well-known/jwks.json`);
  cachedJwks = await resp.json();
  cachedAt = Date.now();
  return cachedJwks;
}

// async/await variant of the same bug: a single load with no second,
// force-refreshed attempt when the kid isn't in the (possibly stale) set.
export const resolveSigningKey = async (domain: string, kid: string) => {
  const jwks = await loadJwks(domain);
  const match = jwks.keys.find((k: any) => k.kid === kid);
  if (!match) {
    throw new Error('Invalid JSON Web Key Set');
  }
  return match;
};
