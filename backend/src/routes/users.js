import { Router } from "express";
import { store } from "../lib/store.js";

const router = Router();

// GET /api/users/search?q=ali
router.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    // Require a longer query and cap the page so this can't be used to walk the
    // whole user table.
    if (q.length < 3) return res.json({ users: [] });
    const users = await store.searchUsers(q);
    res.json({
      users: users
        .slice(0, 5)
        .map((u) => ({ id: u.id, name: u.name, email: u.email })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
