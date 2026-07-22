export function resolveEmail(claims: any): string | null {
  let email = claims.email ?? claims['https://qualty.app/email'];

  if (email && !claims.email_verified) {
    email = null;
  }

  return email ?? null;
}
