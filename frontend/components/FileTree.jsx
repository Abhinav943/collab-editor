"use client";
import { useState } from "react";

export default function FileTree({ files, activeId, onSelect, onCreate }) {
  const [name, setName] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
  }

  return (
    <aside className="pane files">
      <div className="pane-head">
        <span>Files</span>
        <span className="tag">{files.length}</span>
      </div>
      <div className="files-list">
        {files.map((f) => (
          <div
            key={f.id}
            className={`file-item${f.id === activeId ? " on" : ""}`}
            onClick={() => onSelect(f)}
          >
            <span className="mono">{f.path}</span>
          </div>
        ))}
        {files.length === 0 && (
          <p className="empty" style={{ padding: "18px 8px" }}>
            No files yet.
          </p>
        )}
      </div>
      <form className="row2" onSubmit={submit}>
        <input
          className="field"
          placeholder="new-file.js"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </form>
    </aside>
  );
}
