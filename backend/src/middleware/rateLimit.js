/** Fixed-window in-memory rate limiter, keyed by user id (falls back to IP). */
export function rateLimit({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }, windowMs).unref?.();

  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const rec = hits.get(key);

    if (!rec || now > rec.reset) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (rec.count >= max) {
      res.set('Retry-After', String(Math.ceil((rec.reset - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests — slow down.' });
    }
    rec.count += 1;
    next();
  };
}
