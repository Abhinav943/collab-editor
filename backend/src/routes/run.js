import { Router } from "express";
import { LANGUAGES, fileNameFor, buildRunCommand } from "../lib/languages.js";
import { writeFile, isSandboxConfigured } from "../sandbox/sandbox.js";
import { assertRole } from "../auth/access.js";

const router = Router();

const MAX_CODE = 200_000;

// POST /api/run  { projectId, language, filename?, code }
router.post("/", async (req, res, next) => {
  try {
    const { projectId, language, filename, code } = req.body || {};
    if (!projectId || !language || typeof code !== "string") {
      return res
        .status(400)
        .json({ error: "projectId, language and code are required" });
    }
    if (!LANGUAGES[language])
      return res
        .status(400)
        .json({ error: `Unsupported language: ${language}` });
    if (code.length > MAX_CODE)
      return res.status(413).json({ error: "code is too large" });

    // Running writes a file into the shared sandbox, so it needs edit rights.
    await assertRole(req.user.id, projectId, "editor");

    if (!isSandboxConfigured())
      return res.json({ skipped: "sandbox not configured" });

    const path = `/home/user/${fileNameFor(language, code, filename)}`;
    await writeFile(projectId, path, code);

    res.json({ command: buildRunCommand(language, path, code), path });
  } catch (e) {
    next(e);
  }
});

export default router;
