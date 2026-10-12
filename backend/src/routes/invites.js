import { Router } from 'express';
import { store } from '../lib/store.js';

const router = Router();

// GET /api/invites/:token — preview before accepting
router.get('/:token', async (req, res, next) => {
  try {
    const invite = await store.getInviteByToken(req.params.token);
    if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }
    const project = await store.getProject(invite.projectId);
    res.json({ invite: { email: invite.email, role: invite.role, projectName: project?.name } });
  } catch (e) { next(e); }
});

// POST /api/invites/:token/accept
router.post('/:token/accept', async (req, res, next) => {
  try {
    const invite = await store.getInviteByToken(req.params.token);
    if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }
    // The invite must be for the person accepting it.
    if (req.user.email && invite.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'This invite was sent to a different email address' });
    }
    const member = await store.addCollaborator({
      projectId: invite.projectId, userId: req.user.id, role: invite.role,
    });
    await store.markInviteAccepted(invite.id);
    res.json({ member });
  } catch (e) { next(e); }
});

export default router;
