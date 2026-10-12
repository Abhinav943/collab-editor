import { Router } from "express";
import { randomBytes } from "node:crypto";
import { store } from "../lib/store.js";
import config from "../config.js";
import { assertRole, getMembership } from "../auth/access.js";
import { sendInviteEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Only these may ever be stored on a Collaborator / Invite row.
const ASSIGNABLE_ROLES = new Set(["viewer", "editor", "owner"]);

function roleFrom(body, fallback = "editor") {
  const role = body?.role ?? fallback;
  return ASSIGNABLE_ROLES.has(role) ? role : null;
}

// GET /api/projects — only projects I belong to
router.get("/", async (req, res, next) => {
  try {
    res.json({ projects: await store.listProjectsForUser(req.user.id) });
  } catch (e) {
    next(e);
  }
});

// POST /api/projects — create, and become the owner
router.post("/", async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const project = await store.createProject({ name, ownerId: req.user.id });
    await store.addCollaborator({
      projectId: project.id,
      userId: req.user.id,
      role: "owner",
    });
    res.status(201).json({ project });
  } catch (e) {
    next(e);
  }
});

// GET /api/projects/:id
router.get("/:id", async (req, res, next) => {
  try {
    // assertRole returns the membership row, which carries the caller's role.
    const membership = await assertRole(req.user.id, req.params.id, "viewer");
    const project = await store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({
      project,
      files: await store.listFiles(project.id),
      role: membership.role,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/projects/:id/members
router.get("/:id/members", async (req, res, next) => {
  try {
    await assertRole(req.user.id, req.params.id, "viewer");
    res.json({ members: await store.listCollaborators(req.params.id) });
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:id/members  { email, role }  (owner only) — direct add
router.post("/:id/members", async (req, res, next) => {
  try {
    await assertRole(req.user.id, req.params.id, "owner");
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email is required" });

    const role = roleFrom(req.body);
    if (!role)
      return res
        .status(400)
        .json({ error: "role must be viewer, editor or owner" });

    const user = await store.getUserByEmail(email);
    if (!user)
      return res
        .status(404)
        .json({ error: "No user with that email — they must sign up first" });

    const member = await store.addCollaborator({
      projectId: req.params.id,
      userId: user.id,
      role,
    });
    res.status(201).json({ member });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/projects/:id/members/:userId  (owner only)
router.delete("/:id/members/:userId", async (req, res, next) => {
  try {
    await assertRole(req.user.id, req.params.id, "owner");
    await store.removeCollaborator(req.params.id, req.params.userId);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:id/invites  { email, role }  (owner only)
router.post("/:id/invites", async (req, res, next) => {
  try {
    await assertRole(req.user.id, req.params.id, "owner");
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email is required" });

    const role = roleFrom(req.body);
    if (!role)
      return res
        .status(400)
        .json({ error: "role must be viewer, editor or owner" });

    const existing = await store.getUserByEmail(email);
    if (existing && (await getMembership(existing.id, req.params.id))) {
      return res.status(409).json({ error: "That person is already a member" });
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await store.createInvite({
      projectId: req.params.id,
      email,
      role,
      invitedById: req.user.id,
      token,
      expiresAt,
    });

    const project = await store.getProject(req.params.id);
    const acceptUrl = `${config.appUrl}/invite/${token}`;

    // Email is best-effort: a mail failure must not lose the invitation.
    // sendInviteEmail also returns { skipped: true } when no key is configured,
    // which is NOT the same as sent.
    let emailed = false;
    try {
      const result = await sendInviteEmail({
        to: email,
        projectName: project.name,
        inviterName: req.user.name || "Someone",
        role,
        acceptUrl,
      });
      emailed = !result?.skipped;
    } catch (e) {
      logger.warn("invite email failed:", e.message);
    }

    res.status(201).json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      acceptUrl,
      emailed,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/projects/:id/invites  (any member)
router.get("/:id/invites", async (req, res, next) => {
  try {
    await assertRole(req.user.id, req.params.id, "viewer");
    res.json({ invites: await store.listInvites(req.params.id) });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/projects/:id/invites/:inviteId  (owner only)
router.delete("/:id/invites/:inviteId", async (req, res, next) => {
  try {
    await assertRole(req.user.id, req.params.id, "owner");
    await store.revokeInvite(req.params.inviteId);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
