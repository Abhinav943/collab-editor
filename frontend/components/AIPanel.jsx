"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const MODES = [
  { id: "explain", label: "Explain", action: "Explain" },
  { id: "detect", label: "Detect", action: "Detect" },
  { id: "fix", label: "Fix", action: "Fix" },
  { id: "generate", label: "Generate", action: "Generate" },
];

export default function AIPanel({ projectId, language, editorApi, onError }) {
  const [mode, setMode] = useState("explain");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(false);
  const [rewrite, setRewrite] = useState(false);

  useEffect(() => {
    setText("");
    setCode("");
    setApplied(false);
  }, [mode]);

  async function run() {
    if (busy) return;
    setBusy(true);
    setText("");
    setCode("");
    setApplied(false);
    const api = editorApi.current;
    const full = api?.getValue() ?? "";
    const selection = api?.getSelection() ?? "";
    const codeIn = selection || full;

    try {
      if (mode === "explain") {
        const { explanation } = await apiFetch("/api/ai/explain", {
          method: "POST",
          body: {
            projectId,
            language,
            code: codeIn,
            error: "Explain what this code does.",
          },
        });
        setText(explanation || "(no response)");
      }

      if (mode === "detect") {
        const { markers } = await apiFetch("/api/diagnostics", {
          method: "POST",
          body: { projectId, language, code: full },
        });
        const compile = (markers || []).map(
          (m) => `Line ${m.startLineNumber}: ${m.message}`,
        );
        const { explanation } = await apiFetch("/api/ai/explain", {
          method: "POST",
          body: {
            projectId,
            language,
            code: codeIn,
            error: compile.length
              ? compile.join("\n")
              : "No compiler errors. Review for likely runtime problems.",
          },
        });
        setText(
          (compile.length
            ? `Compiler:\n${compile.join("\n")}\n\n`
            : "Compiler: no errors found.\n\n") +
            `Review:\n${explanation || "(no response)"}`,
        );
      }

      if (mode === "fix") {
        const { markers } = await apiFetch("/api/diagnostics", {
          method: "POST",
          body: { projectId, language, code: full },
        });
        const errs = (markers || [])
          .map((m) => `Line ${m.startLineNumber}: ${m.message}`)
          .join("\n");
        const { fixedCode } = await apiFetch("/api/ai/fix", {
          method: "POST",
          body: {
            projectId,
            language,
            code: full,
            error: errs || "Improve this code.",
          },
        });
        setCode(fixedCode || "");
        api?.replaceFile(fixedCode || "");
        setApplied(true);
      }

      if (mode === "generate") {
        const p = rewrite
          ? `${prompt}\n\nReturn the COMPLETE updated file (all existing code plus this change), with nothing else.`
          : prompt;
        const { code: gen } = await apiFetch("/api/ai/generate", {
          method: "POST",
          body: {
            projectId,
            language,
            prompt: p,
            fileContent: full.slice(0, 4000),
          },
        });
        setCode(gen || "");
        if (rewrite) api?.replaceFile(gen || "");
        else api?.insertSuggestion(gen || "");
        setApplied(true);
      }
    } catch (e) {
      onError?.(e.message);
    } finally {
      setBusy(false);
    }
  }

  function accept() {
    editorApi.current?.acceptSuggestion();
    setApplied(false);
    setCode("");
  }
  function reject() {
    editorApi.current?.rejectSuggestion();
    setApplied(false);
    setCode("");
  }

  return (
    <div className="pane ai">
      <div className="pane-head">
        <span>✦ AI</span>
        <span className="tag">{language}</span>
      </div>

      <div className="ai-modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`ai-mode${mode === m.id ? " on" : ""}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="ai-body">
        {mode === "generate" && (
          <>
            <textarea
              className="field"
              rows={3}
              placeholder="Describe the code to generate…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="seg-mini">
              <button
                className={!rewrite ? "on" : ""}
                onClick={() => setRewrite(false)}
              >
                Insert at cursor
              </button>
              <button
                className={rewrite ? "on" : ""}
                onClick={() => setRewrite(true)}
              >
                Rewrite file
              </button>
            </div>
          </>
        )}

        <button
          className="btn btn-primary"
          onClick={run}
          disabled={busy || (mode === "generate" && !prompt.trim())}
        >
          {busy ? (
            <>
              <span className="spinner" /> Working…
            </>
          ) : (
            MODES.find((m) => m.id === mode).action
          )}
        </button>

        {applied && (
          <div className="ai-actions">
            <button className="btn btn-primary" onClick={accept}>
              ✓ Accept
            </button>
            <button className="btn btn-ghost" onClick={reject}>
              ✕ Reject
            </button>
          </div>
        )}

        {code && <pre className="ai-code">{code}</pre>}
        {text && <div className="ai-out">{text}</div>}
      </div>
    </div>
  );
}
