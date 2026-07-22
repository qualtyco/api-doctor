// Same String(...).includes() shape as the broken fixtures, but checking
// for exactly "true" is the one substring a stringified boolean can
// actually contain — unidiomatic, but not dead code.
export function resolveEmail(claims: any): string | null {
  const verified = String(claims.email_verified).includes('true');
  return verified ? (claims.email ?? null) : null;
}
