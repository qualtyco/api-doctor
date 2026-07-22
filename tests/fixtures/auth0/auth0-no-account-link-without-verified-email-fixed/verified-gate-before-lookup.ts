import { prisma } from '../db';

export async function findOrLinkUser(decoded: any) {
  const emailVerified = Boolean(decoded.email_verified);

  if (!emailVerified) {
    return prisma.user.create({
      data: { email: null, auth0Sub: decoded.sub },
    });
  }

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
