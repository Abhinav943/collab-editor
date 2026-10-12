"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import TopBar from "@/components/TopBar";

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/projects")
      .then((d) => setProjects(d.projects || []))
      .catch((e) => setError(e.message));
  }, [user]);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const d = await apiFetch("/api/projects", {
        method: "POST",
        body: { name },
      });
      setProjects((p) => [d.project, ...p]);
      setName("");
    } catch (err) {
      setError(err.message);
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

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="projects-head">
          <h1>Your projects</h1>
          <form className="new-project" onSubmit={create}>
            <input
              className="field"
              style={{ width: 240 }}
              placeholder="New project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Create
            </button>
          </form>
        </div>

        {error && <p className="err">{error}</p>}

        {projects.length === 0 ? (
          <p className="empty">
            No projects yet — create your first one above.
          </p>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/editor/${p.id}`}
                className="card project-card"
              >
                <h3>{p.name}</h3>
                <div className="pid mono">{p.id.slice(0, 12)}…</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
