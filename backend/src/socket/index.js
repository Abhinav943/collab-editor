import { Server } from "socket.io";
import config from "../config.js";
import { logger } from "../lib/logger.js";
import { store } from "../lib/store.js";
import { verifyNeonJwt } from "../auth/verify.js";
import { upsertUser } from "../auth/sync.js";
import { rememberToken } from "../auth/tokenCache.js";
import { assertRole } from "../auth/access.js";
import { createCollabServer } from "../collab/yjs.js";
import { registerPresence } from "./handlers/presence.js";
import { registerChat } from "./handlers/chat.js";
import { registerTerminal } from "./handlers/terminal.js";

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, credentials: true },
  });

  // --- Auth: verify the token sent in the Socket.IO handshake ---
  // The browser cannot set headers on a WebSocket, so the client passes the
  // JWT via the Socket.IO `auth` option; we verify it before accepting.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const claims = await verifyNeonJwt(token);
        socket.data.user = await upsertUser(claims);
        // Warm the token cache so the Yjs namespace can authorise synchronously.
        rememberToken(token, socket.data.user);
        return next();
      } catch (e) {
        logger.debug("socket auth failed:", e.message);
        return next(new Error("unauthorized"));
      }
    }
    if (config.allowGuest) {
      socket.data.user = {
        id: `guest-${socket.id.slice(0, 6)}`,
        name: "Guest",
      };
      return next();
    }
    next(new Error("unauthorized: missing token"));
  });

  io.on("connection", (socket) => {
    logger.debug("socket connected:", socket.id, socket.data.user.id);
    socket.emit("session", { user: socket.data.user }); // tell the client who they are

    socket.on("project:join", async ({ projectId } = {}) => {
      if (!projectId || typeof projectId !== "string") return;

      // Only members may join a project's room (chat, presence, history).
      try {
        await assertRole(socket.data.user.id, projectId, "viewer");
      } catch (e) {
        socket.emit("project:denied", { projectId, error: e.message });
        return;
      }

      socket.join(projectId);
      try {
        socket.emit("chat:history", {
          messages: await store.getMessages(projectId),
        });
      } catch (e) {
        logger.error("chat history failed:", e);
      }
      io.to(projectId).emit("presence:joined", {
        user: socket.data.user,
        at: Date.now(),
      });
    });

    socket.on("project:leave", ({ projectId } = {}) => {
      if (!projectId) return;
      socket.leave(projectId);
      io.to(projectId).emit("presence:left", { user: socket.data.user });
    });

    registerPresence(io, socket);
    registerChat(io, socket);
    registerTerminal(io, socket);

    socket.on("disconnect", () =>
      logger.debug("socket disconnected:", socket.id),
    );
  });

  createCollabServer(io);
  return io;
}
