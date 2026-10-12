import { prisma } from "../lib/prisma.js";

// Higher number = more privilege.
const RANK = { viewer: 1, editor: 2, owner: 3 };

export async function getMembership(userId, projectId) {
  return prisma.collaborator.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

/** Throw a 403-carrying error unless the user has at least `minRole`. */
export async function assertRole(userId, projectId, minRole) {
  const m = await getMembership(userId, projectId);
  if (!m) {
    const e = new Error("You do not have access to this project");
    e.status = 403;
    throw e;
  }

  // Fail closed: an unrecognised role on either side grants nothing.
  const have = RANK[m.role];
  const need = RANK[minRole];
  if (!have || !need || have < need) {
    const e = new Error(`Requires ${minRole} role`);
    e.status = 403;
    throw e;
  }

  return m;
}
