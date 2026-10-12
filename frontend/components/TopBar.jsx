"use client";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth";

export default function TopBar() {
  const { user } = useSession();

  async function signOut() {
    try {
      await authClient.signOut();
    } catch (e) {
      // Never let a failed sign-out leave the button looking dead.
      console.error("[auth] signOut failed:", e);
    }
    // Hard navigation: clears every client-side cache and re-fetches the session,
    // so stale `user` state can't keep you "signed in" after redirecting.
    window.location.href = "/sign-in";
  }

  return (
    <header className="topbar">
      <Link href="/projects" className="brand">
        AI Collab <span className="dot">◆</span> Editor
      </Link>
      <div className="spacer" />
      {user && <span className="user-chip">{user.name || user.email}</span>}
      {user && (
        <button className="btn btn-ghost" onClick={signOut}>
          Sign out
        </button>
      )}
    </header>
  );
}
