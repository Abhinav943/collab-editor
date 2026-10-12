"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { pickColor, initials } from "@/lib/util";

const ROLES = ["viewer", "editor", "owner"];

export default function ShareDialog({ projectId, projectName, user, onClose }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState("");

  const isOwner = members.some(
    (m) => m.userId === user?.id && m.role === "owner",
  );

  async function load() {
    try {
      const [m, i] = await Promise.all([
        apiFetch(`/api/projects/${projectId}/members`),
        apiFetch(`/api/projects/${projectId}/invites`),
      ]);
      setMembers(m.members || []);
      setInvites(i.invites || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [projectId]);

  async function invite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    setLastLink("");
    try {
      const res = await apiFetch(`/api/projects/${projectId}/invites`, {
        method: "POST",
        body: { email: email.trim(), role },
      });
      if (res.emailed) {
        setNotice(`Invitation emailed to ${email.trim()}`);
      } else {
        setNotice(
          `Invite created for ${email.trim()}, but the email could not be sent. Share this link:`,
        );
        setLastLink(res.acceptUrl || "");
      }
      setEmail("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId) {
    try {
      await apiFetch(`/api/projects/${projectId}/invites/${inviteId}`, {
        method: "DELETE",
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeMember(userId) {
    try {
      await apiFetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function changeRole(member, newRole) {
    try {
      await apiFetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: { email: member.user.email, role: newRole },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Share “{projectName}”</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <label className="lbl">Members</label>
          <div className="member-list">
            {members.map((m) => (
              <div className="member-row" key={m.id}>
                <span
                  className="avatar"
                  style={{ background: pickColor(m.userId) }}
                >
                  {initials(m.user?.name || "")}
                </span>
                <div className="member-info">
                  <span className="member-name">
                    {m.user?.name || m.user?.email}
                    {m.userId === user?.id ? " (you)" : ""}
                  </span>
                  <span className="member-email">{m.user?.email}</span>
                </div>
                {isOwner && m.userId !== user?.id ? (
                  <select
                    className="field mini"
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="tag">{m.role}</span>
                )}
                {isOwner && m.userId !== user?.id && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => removeMember(m.userId)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <>
              <label className="lbl">Invite by email</label>
              <form className="invite-form" onSubmit={invite}>
                <input
                  className="field"
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <select
                  className="field mini"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                </select>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy}
                >
                  Invite
                </button>
              </form>
            </>
          )}

          {invites.length > 0 && (
            <>
              <label className="lbl">Pending invites</label>
              <div className="member-list">
                {invites.map((iv) => (
                  <div className="member-row" key={iv.id}>
                    <div className="member-info">
                      <span className="member-name">{iv.email}</span>
                      <span className="member-email">
                        expires {new Date(iv.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="tag">{iv.role}</span>
                    {isOwner && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => revoke(iv.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {notice && <p className="ok">{notice}</p>}
          {lastLink && (
            <div className="invite-link">
              <code className="mono">{lastLink}</code>
              <button
                className="btn btn-ghost"
                onClick={() => navigator.clipboard?.writeText(lastLink)}
              >
                Copy
              </button>
            </div>
          )}

          {error && <p className="err">{error}</p>}
        </div>
      </div>
    </div>
  );
}
