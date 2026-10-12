import { io } from "socket.io-client";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

/** One Socket.IO connection, authenticated with the Neon JWT. */
export function createSocket(token) {
  // No explicit `transports`: keep Socket.IO's default (polling first, then
  // upgrade to websocket). Forcing websocket-only fails behind proxies that
  // block WS, which is common on free hosting.
  return io(BASE, { auth: { token } });
}
