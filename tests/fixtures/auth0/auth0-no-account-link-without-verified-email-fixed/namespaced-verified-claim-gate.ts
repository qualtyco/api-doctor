import { prisma } from '../db';

// Looks like the broken pattern at a glance (claims.email straight into a
// findUnique lookup), but the namespaced email_verified claim is checked
// first — Auth0 custom claims are usually exposed under a namespaced URL
// key rather than a plain property name.
export async function findOrLinkUser(claims: any) {
  const emailVerified = claims['https://qualty.app/email_verified'] === true;
  if (!emailVerified) {
    throw new Error('Email not verified');
  }

  const existing = await prisma.user.findUnique({
    where: { email: claims.email },
  });

  return existing;
}
