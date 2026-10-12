import { prisma } from "./prisma.js";

// Map a DB row to the shape the frontend already expects.
function toClientMessage(m) {
  return {
    id: m.id,
    projectId: m.projectId,
    text: m.text,
    user: { id: m.authorId, name: m.authorName },
    at: m.createdAt.getTime(),
  };
}

export const store = {
  // --- projects ---
  createProject({ name, ownerId = "anonymous" }) {
    return prisma.project.create({
      data: { name: name || "Untitled project", ownerId },
    });
  },
  getProject(id) {
    return prisma.project.findUnique({ where: { id } });
  },

  // --- files ---
  listFiles(projectId) {
    return prisma.file.findMany({
      where: { projectId },
      orderBy: { path: "asc" },
    });
  },
  getFile(id) {
    return prisma.file.findUnique({ where: { id } });
  },
  createFile({ projectId, path, content = "" }) {
    return prisma.file.create({ data: { projectId, path, content } });
  },
  updateFile(id, content) {
    return prisma.file.update({ where: { id }, data: { content } });
  },
  deleteFile(id) {
    return prisma.file.delete({ where: { id } });
  },

  // --- chat ---
  async addMessage({ projectId, text, user }) {
    const m = await prisma.chatMessage.create({
      data: {
        projectId,
        text,
        authorId: user?.id ?? "anonymous",
        authorName: user?.name ?? "Guest",
      },
    });
    return toClientMessage(m);
  },
  async getMessages(projectId, limit = 100) {
    // Newest `limit` messages, returned oldest-first for display.
    const rows = await prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse().map(toClientMessage);
  },

  // --- users ---
  getUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },
  searchUsers(q) {
    return prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
    });
  },

  // --- collaborators ---
  addCollaborator({ projectId, userId, role = "editor" }) {
    return prisma.collaborator.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role },
      create: { projectId, userId, role },
    });
  },
  listCollaborators(projectId) {
    return prisma.collaborator.findMany({
      where: { projectId },
      include: { user: true },
    });
  },
  removeCollaborator(projectId, userId) {
    return prisma.collaborator.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  },
  listProjectsForUser(userId) {
    return prisma.project.findMany({
      where: { collaborators: { some: { userId } } },
      orderBy: { createdAt: "desc" },
    });
  },

  // --- invites ---
  createInvite({ projectId, email, role, invitedById, token, expiresAt }) {
    return prisma.invite.create({
      data: { projectId, email, role, invitedById, token, expiresAt },
    });
  },
  getInviteByToken(token) {
    return prisma.invite.findUnique({ where: { token } });
  },
  listInvites(projectId) {
    return prisma.invite.findMany({
      where: { projectId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  },
  markInviteAccepted(id) {
    return prisma.invite.update({
      where: { id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
  },
  revokeInvite(id) {
    return prisma.invite.update({ where: { id }, data: { status: "revoked" } });
  },
};
