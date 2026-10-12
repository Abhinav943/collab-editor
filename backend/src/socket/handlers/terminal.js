import { startPty, writePty, resizePty, stopPty } from "../../sandbox/pty.js";
import { isSandboxConfigured } from "../../sandbox/sandbox.js";
import { assertRole } from "../../auth/access.js";
import { logger } from "../../lib/logger.js";

export function registerTerminal(io, socket) {
  // Wrap each handler so a missing key or a thrown error reports to the client
  // instead of crashing the socket.
  const guard =
    (fn) =>
    async (payload = {}) => {
      if (!isSandboxConfigured()) {
        socket.emit("terminal:data", {
          data: "\r\nsandbox not configured — set E2B_API_KEY\r\n",
        });
        return;
      }
      try {
        await fn(payload);
      } catch (e) {
        logger.error("terminal error:", e);
        socket.emit("terminal:data", { data: `\r\n[error] ${e.message}\r\n` });
      }
    };

  socket.on(
    "terminal:start",
    guard(async ({ projectId, cols, rows } = {}) => {
      if (!projectId || typeof projectId !== "string") {
        throw new Error("projectId is required");
      }
      // Only members may open a shell in a project's sandbox.
      await assertRole(socket.data.user.id, projectId, "viewer");

      const pid = await startPty(socket, { projectId, cols, rows });
      socket.emit("terminal:started", { pid });
    }),
  );

  socket.on(
    "terminal:input",
    guard(({ data } = {}) => writePty(socket.id, data)),
  );
  socket.on(
    "terminal:resize",
    guard(({ cols, rows } = {}) => resizePty(socket.id, { cols, rows })),
  );
  socket.on(
    "terminal:stop",
    guard(() => stopPty(socket.id)),
  );

  socket.on("disconnect", () => {
    stopPty(socket.id); // never leave a shell running after the user leaves
  });
}
