const TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // token -> { user, exp }

export function rememberToken(token, user) {
  if (!token || !user) return;
  cache.set(token, { user, exp: Date.now() + TTL_MS });
}

export function userForToken(token) {
  const hit = cache.get(token);
  if (!hit) return null;
  if (hit.exp < Date.now()) { cache.delete(token); return null; }
  return hit.user;
}

// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (v.exp < now) cache.delete(k);
}, TTL_MS).unref?.();
