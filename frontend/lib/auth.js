"use client";
import { createAuthClient } from "@neondatabase/auth";
import { useCallback, useEffect, useState } from "react";

export const authClient = createAuthClient(
  process.env.NEXT_PUBLIC_NEON_AUTH_URL,
  {
    fetchOptions: { credentials: "include" },
  },
);

// The token is good for ~15 minutes. Cache it briefly so the editor's several
// calls per interaction don't each hit the auth SDK.
let cached = { token: null, at: 0 };
const CACHE_MS = 60_000;

export function useSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await authClient.getSession();
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  return { user, loading, refresh };
}

export async function getToken() {
  const now = Date.now();
  if (cached.token && now - cached.at < CACHE_MS) return cached.token;

  try {
    const res = await authClient.token();
    const d = res?.data;
    const token =
      d?.token ?? d?.session?.token ?? d?.session?.access_token ?? null;
    if (!token) {
      console.warn(
        "[auth] no token found. data.session keys:",
        d?.session ? Object.keys(d.session) : d,
      );
      return cached.token; // fall back to the last good one
    }
    cached = { token, at: now };
    return token;
  } catch (e) {
    console.error("[auth] token() threw:", e);
    return cached.token;
  }
}
