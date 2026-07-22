async function getJwks(domain: string, options: { forceRefresh: boolean }) {
  const resp = await fetch(`https://${domain}/.well-known/jwks.json`);
  return resp.json();
}

// Looks like the broken shape (one getJwks() call, then .find() on kid),
// but forceRefresh: true here means there is no cache to go stale in the
// first place — every call already fetches live data, so a miss means the
// kid genuinely doesn't exist rather than the cache being out of date.
export async function resolveSigningKey(domain: string, kid: string) {
  const jwks = await getJwks(domain, { forceRefresh: true });
  const match = jwks.keys.find((k: any) => k.kid === kid);
  if (!match) {
    throw new Error('Invalid JSON Web Key Set');
  }
  return match;
}
