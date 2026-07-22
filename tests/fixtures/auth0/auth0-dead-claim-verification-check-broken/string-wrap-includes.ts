export function resolveEmail(claims: any): string | null {
  let email = claims.email ?? claims['https://qualty.app/email'];

  // String(true) === "true", String(false) === "false" — neither contains
  // "email", so this branch can never execute.
  if (!email && String(claims.email_verified).includes('email')) {
    email = null;
  }

  return email ?? null;
}
