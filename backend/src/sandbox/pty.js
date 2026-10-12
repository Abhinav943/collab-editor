import { getSandbox } from "./sandbox.js";
import { logger } from "../lib/logger.js";

// One interactive session per socket connection.
const sessions = new Map(); // socketId -> { pid, projectId, decoder }

export async function startPty(
  socket,
  { projectId, cols = 80, rows = 24 } = {},
) {
  if (!projectId) throw new Error("projectId is required");
  await stopPty(socket.id); // one PTY per socket

  const sandbox = await getSandbox(projectId);
  const decoder = new TextDecoder("utf-8");

  const terminal = await sandbox.pty.create({
    cols,
    rows,
    timeoutMs: 0, // keep the session open (default is 60s)
    cwd: "/home/user",
    onData: (data) => {
      // stream decoded output to the client (stream:true keeps multi-byte chars intact)
      socket.emit("terminal:data", {
        data: decoder.decode(data, { stream: true }),
      });
    },
  });

  sessions.set(socket.id, { pid: terminal.pid, projectId, decoder });

  // Tell the client when the shell exits (e.g. the user types `exit`).
  terminal
    .wait()
    .then((res) =>
      socket.emit("terminal:exit", { exitCode: res?.exitCode ?? 0 }),
    )
    .catch((e) =>
      socket.emit("terminal:exit", { exitCode: e?.result?.exitCode ?? 0 }),
    )
    .finally(() => sessions.delete(socket.id));

  logger.info("pty started for", projectId, "pid", terminal.pid);
  return terminal.pid;
}

export async function writePty(socketId, data) {
  const s = sessions.get(socketId);
  if (!s || data == null) return;
  const sandbox = await getSandbox(s.projectId);
  await sandbox.pty.sendInput(s.pid, new TextEncoder().encode(String(data)));
}

export async function resizePty(socketId, { cols, rows } = {}) {
  const s = sessions.get(socketId);
  if (!s || !cols || !rows) return;
  const sandbox = await getSandbox(s.projectId);
  await sandbox.pty.resize(s.pid, { cols, rows });
}

export async function stopPty(socketId) {
  const s = sessions.get(socketId);
  if (!s) return;
  sessions.delete(socketId);
  try {
    const sandbox = await getSandbox(s.projectId);
    await sandbox.pty.kill(s.pid);
  } catch (e) {
    logger.warn("pty kill failed:", e.message);
  }
}
