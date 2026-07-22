import jwt from 'jsonwebtoken';
import { prisma } from '../db';

// New Auth0 identity is silently re-linked to an existing user found by
// email alone — no email_verified gate anywhere in this function.
export async function findOrLinkUser(decoded: any) {
  const existing = await prisma.user.findUnique({
    where: { email: decoded.email },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { auth0Sub: decoded.sub },
    });
    return existing;
  }

  return prisma.user.create({
    data: { email: decoded.email, auth0Sub: decoded.sub },
  });
}
