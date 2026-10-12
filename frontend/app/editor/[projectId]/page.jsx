"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useSession, getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { createSocket } from "@/lib/socket";
import { langFromPath } from "@/lib/languages";
import { initials } from "@/lib/util";
import TopBar from "@/components/TopBar";
import FileTree from "@/components/FileTree";
import Chat from "@/components/Chat";
import AIPanel from "@/components/AIPanel";
import ShareDialog from "@/components/ShareDialog";

const CollaborativeEditor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
});
const Terminal = dynamic(() => import("@/components/Terminal"), { ssr: false });

export default function EditorPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const { user, loading } = useSession();

  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [project, setProject] = useState(null);
  const [role, setRole] = useState(null);
  const [files, setFiles] = useState([]);
  const [active, setActive] = useState(null);
  const [peers, setPeers] = useState([]);
  const [error, setError] = useState("");
  const [sideTab, setSideTab] = useState("chat");
  const [shareOpen, setShareOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const editorApi = useRef(null);
  const codeRef = useRef("");

  const canRun = role !== "viewer";

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !projectId) return;
    (async () => {
      try {
        const jwt = await getToken();
        setToken(jwt);
        const data = await apiFetch(`/api/projects/${projectId}`);
        setProject(data.project);
        setRole(data.role ?? null);
        setFiles(data.files || []);
        setActive((data.files || [])[0] || null);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [user, projectId]);

  // One authenticated socket for chat + terminal + presence.
  useEffect(() => {
    if (!token) return;
    const s = createSocket(token);

    // Neon tokens expire in 15 minutes. Keep the handshake token fresh so a
    // reconnect isn't refused — and refresh on a rejected attempt so the
    // automatic retry succeeds.
    const refreshAuth = async () => {
      const fresh = await getToken();
      if (fresh) s.auth = { token: fresh };
    };
    const authTimer = setInterval(refreshAuth, 10 * 60 * 1000);
    const onConnectError = (err) => {
      if (/unauthoriz|jwt|token/i.test(err?.message || "")) refreshAuth();
    };
    s.on("connect_error", onConnectError);

    setSocket(s);
    return () => {
      clearInterval(authTimer);
      s.off("connect_error", onConnectError);
      s.close();
    };
  }, [token]);

  async function createFile(path) {
    try {
      const d = await apiFetch("/api/files", {
        method: "POST",
        body: { projectId, path, content: "" },
      });
      setFiles((f) => [...f, d.file]);
      setActive(d.file);
    } catch (e) {
      setError(e.message);
    }
  }

  async function run() {
    if (!active || !socket || running || !canRun) return; // ignore repeat clicks
    setRunning(true);
    const language = langFromPath(active.path);
    try {
      const { command } = await apiFetch("/api/run", {
        method: "POST",
        body: {
          projectId,
          language,
          filename: active.path,
          code: codeRef.current,
        },
      });
      if (command) socket.emit("terminal:input", { data: `${command}\n` });
    } catch (e) {
      setError(e.message);
    } finally {
      // stay disabled briefly so a compile+run can get going before another click
      setTimeout(() => setRunning(false), 4000);
    }
  }

  if (loading || !project) {
    return (
      <div className="auth-wrap">
        <span className="badge">Loading project…</span>
      </div>
    );
  }

  return (
    <div className="shell">
      <TopBar />
      <div className="projbar">
        <span className="brand">{project.name}</span>
        <span className="tag mono">{projectId.slice(0, 8)}</span>
        {role && <span className="tag">{role}</span>}
        <div className="spacer" />
        <div className="avatars">
          {peers.slice(0, 5).map((p, i) => (
            <span
              key={i}
              className="avatar"
              style={{ background: p.color }}
              title={p.name}
            >
              {initials(p.name)}
            </span>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={() => setShareOpen(true)}>
          Share
        </button>
      </div>

      {error && (
        <p className="err" style={{ padding: "0 16px" }}>
          {error}
        </p>
      )}

      <div className="workarea">
        <FileTree
          files={files}
          activeId={active?.id}
          onSelect={setActive}
          onCreate={createFile}
        />

        <section className="pane editor-wrap">
          <div className="pane-head">
            <span className="mono">{active?.path || "no file"}</span>
            <div className="spacer" />
            <div className="seg-mini">
              <button
                className={sideTab === "chat" ? "on" : ""}
                onClick={() => setSideTab("chat")}
              >
                Chat
              </button>
              <button
                className={sideTab === "ai" ? "on" : ""}
                onClick={() => setSideTab("ai")}
              >
                ✦ AI
              </button>
            </div>
            {canRun && (
              <button
                className="btn btn-primary run-btn"
                onClick={run}
                disabled={!active || running}
              >
                {running ? (
                  <>
                    <span className="spinner" /> Running…
                  </>
                ) : (
                  "▶ Run"
                )}
              </button>
            )}
          </div>

          <div className="editor-host">
            {active ? (
              <CollaborativeEditor
                file={active}
                token={token}
                user={user}
                projectId={projectId}
                onAwareness={setPeers}
                onCode={(c) => (codeRef.current = c)}
                onReady={(api) => {
                  editorApi.current = api;
                }}
              />
            ) : (
              <p className="empty">Create a file to start editing.</p>
            )}
          </div>
        </section>

        <aside className="side">
          {sideTab === "chat" ? (
            <Chat socket={socket} projectId={projectId} user={user} />
          ) : (
            <AIPanel
              projectId={projectId}
              language={active ? langFromPath(active.path) : "plaintext"}
              editorApi={editorApi}
              onError={setError}
            />
          )}
          <section className="pane term">
            <div className="pane-head">
              <span>Terminal</span>
              <span className="tag">e2b</span>
            </div>
            <Terminal socket={socket} projectId={projectId} />
          </section>
        </aside>
      </div>

      {shareOpen && (
        <ShareDialog
          projectId={projectId}
          projectName={project.name}
          user={user}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
