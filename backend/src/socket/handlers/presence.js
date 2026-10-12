/**
 * Presence — who is in the room. Broadcast to others in the same project.
 * In Phase 2 this folds into the Yjs awareness protocol for live cursors.
 */
export function registerPresence(io, socket) {
  socket.on("presence:update", ({ projectId, cursor } = {}) => {
    if (!projectId) return;
    socket.to(projectId).emit("presence:update", {
      user: socket.data.user,
      cursor: cursor ?? null,
      at: Date.now(),
    });
  });
}
