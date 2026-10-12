import { prisma } from "../lib/prisma.js";

/** Map Neon Auth JWT claims to our User shape. */
export function toAppUser(claims) {
  const meta = claims.user_metadata || {};
  return {
    id: claims.sub,
    email: claims.email || null,
    name:
      meta.full_name ||
      meta.name ||
      (claims.email ? claims.email.split("@")[0] : null),
    avatarUrl: meta.avatar_url || null,
  };
}

/** Mirror the Neon Auth user into our own table on first sight. */
export async function upsertUser(claims) {
  const u = toAppUser(claims);
  return prisma.user.upsert({
    where: { id: u.id },
    update: { email: u.email, name: u.name, avatarUrl: u.avatarUrl },
    create: u,
  });
}
