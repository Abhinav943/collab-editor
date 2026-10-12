import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';

const router = Router();

// GET /api/me — the signed-in user. Proves the auth pipeline works.
router.get('/', requireAuth, (req, res) => {
  const { id, email, name, avatarUrl } = req.user;
  res.json({ user: { id, email, name, avatarUrl } });
});

export default router;
