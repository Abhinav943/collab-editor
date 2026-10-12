"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth";

export default function TopBar() {
  const { user } = useSession();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/sign-in");
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
