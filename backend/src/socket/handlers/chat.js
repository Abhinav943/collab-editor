import { store } from "../../lib/store.js";
import { logger } from "../../lib/logger.js";

const MAX_LEN = 4000;
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 20;

export function registerChat(io, socket) {
  let windowStart = Date.now();
  let sent = 0;

  socket.on("chat:send", async ({ projectId, text } = {}) => {
    if (!projectId || typeof text !== "string" || !text.trim()) return;

    // Per-socket throttle: a client can't flood the room or the DB.
    const now = Date.now();
    if (now - windowStart > WINDOW_MS) {
      windowStart = now;
      sent = 0;
    }
    if (++sent > MAX_PER_WINDOW) {
      socket.emit("chat:error", { error: "Slow down — too many messages." });
      return;
    }

    try {
      const message = await store.addMessage({
        projectId,
        text: text.slice(0, MAX_LEN),
        user: socket.data.user,
      });
      io.to(projectId).emit("chat:message", message);
    } catch (e) {
      logger.error("chat:send failed:", e);
    }
  });
}
