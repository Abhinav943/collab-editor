"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();
  const { user, loading } = useSession();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user || !token) return;
    apiFetch(`/api/invites/${token}`)
      .then((d) => setInvite(d.invite))
      .catch((e) => setError(e.message));
  }, [user, token]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const d = await apiFetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      setDone(true);
      const pid = d.member?.projectId;
      setTimeout(() => router.push(pid ? `/editor/${pid}` : "/projects"), 900);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="auth-wrap">
        <span className="badge">Loading…</span>
      </div>
    );

  if (!user) {
    return (
      <div className="auth-wrap">
        <div className="auth-card panel fade-up">
          <h1>You've been invited</h1>
          <p className="sub">Sign in to accept the invitation.</p>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/sign-in")}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card panel fade-up">
        <h1>Project invitation</h1>
        {!invite && !error && <p className="sub">Loading…</p>}
        {error && <p className="err">{error}</p>}
        {invite && !done && (
          <>
            <p className="sub">
              You've been invited to <strong>{invite.projectName}</strong> as{" "}
              <strong>{invite.role}</strong>.
            </p>
            <button
              className="btn btn-primary"
              onClick={accept}
              disabled={busy}
            >
              {busy ? "Accepting…" : "Accept invitation"}
            </button>
          </>
        )}
        {done && <p className="ok">Accepted — opening the project…</p>}
      </div>
    </div>
  );
}
