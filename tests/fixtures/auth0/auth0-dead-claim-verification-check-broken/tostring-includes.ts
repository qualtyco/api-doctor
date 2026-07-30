const EXPECTED_ISSUER = 'https://qualty.us.auth0.com/';

export function resolvePhone(claims: any): string | null {
  if (claims.iss !== EXPECTED_ISSUER) return null;

  // .toString() on a boolean only ever produces "true"/"false" — checking
  // for "yes" can never match, so this guard never trusts the phone number.
  if (claims.phone_verified.toString().includes('yes')) {
    return claims.phone_number ?? null;
  }
  return null;
}
