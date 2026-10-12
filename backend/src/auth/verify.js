import { createRemoteJWKSet, jwtVerify } from "jose";
import config from "../config.js";

const base = (config.neonAuthBaseUrl || "").replace(/\/+$/, "");
const JWKS = base
  ? createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`))
  : null;

// Neon Auth issues tokens whose `iss` is the *origin* of the auth URL, with no
// path — even though the base URL includes one (/neondb/auth). If Neon ever
// starts including the path in `iss`, every request here would 401; this is the
// line to change if that happens.
const ISSUER = base ? new URL(base).origin : undefined;

/**
 * Verify a Neon Auth (Managed Better Auth) access token, returning its claims.
 *
 * Tokens are EdDSA (Ed25519) signed and expire in 15 minutes; the frontend
 * refreshes them via authClient.token(). `jose` verifies EdDSA out of the box.
 */
export async function verifyNeonJwt(token) {
  if (!JWKS) throw new Error("NEON_AUTH_BASE_URL is not set");
  const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER });
  return payload;
}
