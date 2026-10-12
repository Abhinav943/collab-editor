import { Router } from "express";

const router = Router();

// GET /api/health — used by the uptime monitor that keeps Render warm.
router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-collab-editor-backend",
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
  });
});

export default router;
