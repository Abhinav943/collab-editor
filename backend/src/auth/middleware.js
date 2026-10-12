import { verifyNeonJwt } from "./verify.js";
import { upsertUser } from "./sync.js";
import { rememberToken } from "./tokenCache.js";
import { logger } from "../lib/logger.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  // 1. Verify the token — only a bad token is a 401.
  let claims;
  try {
    claims = await verifyNeonJwt(token);
  } catch (e) {
    logger.debug("token verification failed:", e.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // 2. Mirror the user into our DB — a failure here is a 500, not a 401.
  try {
    req.user = await upsertUser(claims);
  } catch (e) {
    logger.error("user sync failed:", e.message);
    return res.status(500).json({ error: "User sync failed" });
  }

  // 3. Warm the token cache so the Yjs namespace can authorise synchronously.
  rememberToken(token, req.user);

  next();
}
