import { Router } from "express";
import { LANGUAGES, fileNameFor, shellQuote } from "../lib/languages.js";
import {
  runCommand,
  writeFile,
  isSandboxConfigured,
} from "../sandbox/sandbox.js";
import { parseDiagnostics } from "../lib/diagnostics.js";
import { assertRole } from "../auth/access.js";

const router = Router();

const MAX_CODE = 200_000;

// POST /api/diagnostics  { projectId, language, code, filename? }
router.post("/", async (req, res, next) => {
  try {
    const { projectId, language, code, filename } = req.body || {};

    if (!projectId || !language || typeof code !== "string") {
      return res
        .status(400)
        .json({ error: "projectId, language, and code are required" });
    }

    const def = LANGUAGES[language];
    if (!def) {
      return res
        .status(400)
        .json({ error: `Unsupported language: ${language}` });
    }

    if (code.length > MAX_CODE) {
      return res.status(413).json({ error: "code is too large" });
    }

    // Check that the user has access to the project.
    await assertRole(req.user.id, projectId, "viewer");

    if (!isSandboxConfigured()) {
      return res.json({ markers: [], skipped: "sandbox not configured" });
    }

    const path = `/home/user/${fileNameFor(language, code, filename)}`;

    await writeFile(projectId, path, code);

    const cmd = def.check.replace("{file}", shellQuote(path));
    const result = await runCommand(projectId, cmd);

    const output = `${result.stdout || ""}${result.stderr || ""}`;
    const markers = parseDiagnostics(language, output);

    res.json({
      markers,
      exitCode: result.exitCode ?? 0,
      output: output.slice(0, 4000),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
