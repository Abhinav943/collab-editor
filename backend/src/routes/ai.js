import { Router } from "express";
import { generate } from "../ai/provider.js";
import { assertRole } from "../auth/access.js";

const router = Router();

const LIMITS = {
  prompt: 8_000,
  code: 64_000,
  fileContent: 64_000,
  prefix: 8_000,
  suffix: 8_000,
  error: 8_000,
};

/** Returns the name of the first over-long field, or null. */
function tooBig(fields) {
  for (const [name, value] of Object.entries(fields)) {
    const max = LIMITS[name];
    if (max && typeof value === "string" && value.length > max) return name;
  }
  return null;
}

// POST /api/ai/generate  { projectId, language, prompt, fileContent? }
router.post("/generate", async (req, res, next) => {
  try {
    const {
      projectId,
      language = "javascript",
      prompt,
      fileContent,
    } = req.body || {};
    if (!projectId || !prompt)
      return res
        .status(400)
        .json({ error: "projectId and prompt are required" });

    const big = tooBig({ prompt, fileContent });
    if (big) return res.status(413).json({ error: `${big} is too large` });

    await assertRole(req.user.id, projectId, "viewer");

    const code = await generate({
      system:
        "You are an expert coding assistant embedded in a code editor. Respond with ONLY the requested code — " +
        "no explanations, no markdown fences, no commentary.",
      prompt:
        `Language: ${language}\n\nTask: ${prompt}\n\n` +
        (fileContent ? `Current file for context:\n${fileContent}\n\n` : "") +
        "Return only the code.",
    });
    res.json({ code: code.trim() });
  } catch (e) {
    next(e);
  }
});

// POST /api/ai/complete  { projectId, language, prefix, suffix? }  (inline suggestion)
router.post("/complete", async (req, res, next) => {
  try {
    const {
      projectId,
      language = "javascript",
      prefix = "",
      suffix = "",
    } = req.body || {};
    if (!projectId)
      return res.status(400).json({ error: "projectId is required" });

    const big = tooBig({ prefix, suffix });
    if (big) return res.status(413).json({ error: `${big} is too large` });

    await assertRole(req.user.id, projectId, "viewer");

    const completion = await generate({
      system:
        "You complete code. Return ONLY the text to insert at the cursor — no explanation, no fences, " +
        "no repetition of existing code.",
      prompt:
        `Language: ${language}\n\nCode before the cursor:\n${prefix}\n\nCode after the cursor:\n${suffix}\n\n` +
        "Return only the text to insert at the cursor.",
    });
    res.json({ completion });
  } catch (e) {
    next(e);
  }
});

// POST /api/ai/explain  { projectId, language, code, error }
router.post("/explain", async (req, res, next) => {
  try {
    const {
      projectId,
      language = "javascript",
      code = "",
      error = "",
    } = req.body || {};
    if (!projectId || !error)
      return res
        .status(400)
        .json({ error: "projectId and error are required" });

    const big = tooBig({ code, error });
    if (big) return res.status(413).json({ error: `${big} is too large` });

    await assertRole(req.user.id, projectId, "viewer");

    const explanation = await generate({
      system:
        "You are a coding tutor. Explain the error clearly in 2-4 sentences, then give the fix in one sentence.",
      prompt: `Language: ${language}\n\nCode:\n${code}\n\nError:\n${error}\n\nExplain the error and how to fix it.`,
    });
    res.json({ explanation: explanation.trim() });
  } catch (e) {
    next(e);
  }
});

// POST /api/ai/fix  { projectId, language, code, error }
router.post("/fix", async (req, res, next) => {
  try {
    const {
      projectId,
      language = "javascript",
      code = "",
      error = "",
    } = req.body || {};
    if (!projectId || !code)
      return res.status(400).json({ error: "projectId and code are required" });

    const big = tooBig({ code, error });
    if (big) return res.status(413).json({ error: `${big} is too large` });

    await assertRole(req.user.id, projectId, "viewer");

    const fixedCode = await generate({
      system:
        "You fix code. Return ONLY the full corrected file — no explanations, no markdown fences.",
      prompt: `Language: ${language}\n\nCode:\n${code}\n\nError:\n${error}\n\nReturn the corrected file.`,
    });
    res.json({ fixedCode: fixedCode.trim() });
  } catch (e) {
    next(e);
  }
});

export default router;
