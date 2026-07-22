export function resolvePhone(claims: any): string | null {
  // .toString() on a boolean only ever produces "true"/"false" — checking
  // for "yes" can never match, so this guard never trusts the phone number.
  if (claims.phone_verified.toString().includes('yes')) {
    return claims.phone_number ?? null;
  }
  return null;
}
