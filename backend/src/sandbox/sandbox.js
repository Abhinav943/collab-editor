import { Sandbox } from "e2b";
import config from "../config.js";
import { logger } from "../lib/logger.js";

const IDLE_MS = 10 * 60_000;   // E2B kills the sandbox after this long with no use
const RUN_TIMEOUT_MS = 60_000;
const BOOTSTRAP_TIMEOUT_MS = 480_000;

const BOOTSTRAP_CMD =
  "if ! command -v javac >/dev/null 2>&1 || ! command -v go >/dev/null 2>&1; then " +
  "sudo apt-get update -qq && " +
  "sudo apt-get install -y -qq openjdk-17-jdk-headless golang-go; fi";

const sandboxes = new Map(); // projectId -> { sandbox, lastUsed }

export function isSandboxConfigured() {
  return Boolean(config.e2bApiKey);
}

function assertConfigured() {
  if (!isSandboxConfigured()) {
    const err = new Error("Sandbox not configured — set E2B_API_KEY to enable the terminal.");
    err.code = "SANDBOX_NOT_CONFIGURED";
    throw err;
  }
}

async function bootstrap(sandbox) {
  try {
    logger.info("sandbox: ensuring toolchains (first run can take a minute)");
    await sandbox.commands.run(BOOTSTRAP_CMD, { timeoutMs: BOOTSTRAP_TIMEOUT_MS });
  } catch (e) {
    logger.warn("sandbox bootstrap failed:", e.message);
  }
}

export async function getSandbox(projectId) {
  assertConfigured();

  const rec = sandboxes.get(projectId);
  if (rec) {
    try {
      // refresh E2B's own idle timer so an active project isn't reaped mid-session
      await rec.sandbox.setTimeout(IDLE_MS);
      rec.lastUsed = Date.now();
      return rec.sandbox;
    } catch {
      logger.warn("sandbox for", projectId, "expired; recreating");
      sandboxes.delete(projectId);
    }
  }

  const sandbox = await Sandbox.create({ timeoutMs: IDLE_MS });
  sandboxes.set(projectId, { sandbox, lastUsed: Date.now() });
  logger.info("sandbox created for", projectId, "->", sandbox.sandboxId);
  await bootstrap(sandbox);
  return sandbox;
}

/** Run a command and stream its output. A non-zero exit is a result, not an exception. */
export async function runCommand(projectId, command, { onStdout, onStderr } = {}) {
  const sandbox = await getSandbox(projectId);
  try {
    const handle = await sandbox.commands.run(command, {
      background: true,
      timeoutMs: RUN_TIMEOUT_MS,
      onStdout: onStdout ? (d) => onStdout(d) : undefined,
      onStderr: onStderr ? (d) => onStderr(d) : undefined,
    });
    return await handle.wait();
  } catch (e) {
    if (e && e.result) return e.result;
    throw e;
  }
}

export async function killSandbox(projectId) {
  const rec = sandboxes.get(projectId);
  if (!rec) return;
  sandboxes.delete(projectId);
  try { await rec.sandbox.kill(); } catch { /* already gone */ }
}

export async function writeFile(projectId, path, content) {
  const sandbox = await getSandbox(projectId);
  await sandbox.files.write(path, content);
}

/** Close sandboxes idle beyond maxIdleMs and prune the map. */
export async function reapIdleSandboxes(maxIdleMs) {
  const now = Date.now();
  let killed = 0;
  for (const [projectId, rec] of sandboxes) {
    if (now - rec.lastUsed > maxIdleMs) {
      sandboxes.delete(projectId);
      try { await rec.sandbox.kill(); } catch { /* already gone */ }
      killed += 1;
    }
  }
  return killed;
}
