import { Router } from "express";
import { publicLanguages } from "../lib/languages.js";

const router = Router();

// GET /api/languages — the languages the editor supports.
// The frontend uses this to build its language picker.
router.get("/", (_req, res) => {
  res.json({ languages: publicLanguages() });
});

export default router;
