"use client";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
loader.config({ monaco });

import { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";
import { MonacoBinding } from "y-monaco";
import { CYBER_THEME } from "@/lib/monaco-theme";
import { pickColor } from "@/lib/util";
import { langFromPath } from "@/lib/languages";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const DIAG_LANGS = new Set(["c", "cpp", "java", "python", "go", "javascript"]);

/** Strip anything that could break out of the injected CSS rule. */
function cssSafe(value = "") {
  return String(value)
    .replace(/[\\{}'"<>;\n\r]/g, "")
    .slice(0, 24);
}

function applyCursorStyles(awareness) {
  let css = "";
  awareness.getStates().forEach((state, clientId) => {
    const c = state?.user?.color;
    if (!c) return;
    css += `.yRemoteSelection-${clientId}{background:${c}33;}`;
    css += `.yRemoteSelectionHead-${clientId}{border-color:${c};}`;
    css +=
      `.yRemoteSelectionHead-${clientId}::after{content:'${cssSafe(state.user.name)}';` +
      `background:${c};color:#04121f;font:600 10px var(--mono);padding:1px 5px;border-radius:3px;` +
      `position:absolute;top:-17px;left:-2px;white-space:nowrap;}`;
  });
  let el = document.getElementById("y-cursor-styles");
  if (!el) {
    el = document.createElement("style");
    el.id = "y-cursor-styles";
    document.head.appendChild(el);
  }
  el.textContent = css;
}

const inlineCtx = { projectId: null, language: "plaintext", token: null };
let inlineRegistered = false;
let lastInlineAt = 0;

function registerInline(mono) {
  mono.languages.registerInlineCompletionsProvider(
    { pattern: "**" },
    {
      async provideInlineCompletions(model, position) {
        if (Date.now() - lastInlineAt < 1500) return { items: [] };
        if (!inlineCtx.token || !inlineCtx.projectId) return { items: [] };
        const lineBefore = model
          .getLineContent(position.lineNumber)
          .slice(0, position.column - 1);
        if (lineBefore.trim().length < 2) return { items: [] };

        lastInlineAt = Date.now();
        const offset = model.getOffsetAt(position);
        const full = model.getValue();
        try {
          const { completion } = await apiFetch("/api/ai/complete", {
            method: "POST",
            token: inlineCtx.token,
            body: {
              projectId: inlineCtx.projectId,
              language: inlineCtx.language,
              prefix: full.slice(Math.max(0, offset - 1500), offset),
              suffix: full.slice(offset, offset + 400),
            },
          });
          if (!completion) return { items: [] };
          return {
            items: [
              {
                insertText: completion,
                range: new mono.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column,
                ),
              },
            ],
          };
        } catch {
          return { items: [] };
        }
      },
      freeInlineCompletions() {},
      disposeInlineCompletions() {},
    },
  );
}

export default function CollaborativeEditor({
  file,
  token,
  user,
  projectId,
  onAwareness,
  onCode,
  onReady,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const suggestionRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    inlineCtx.projectId = projectId;
    inlineCtx.token = token;
    inlineCtx.language = file ? langFromPath(file.path) : "plaintext";
  }, [projectId, token, file?.path]);

  // The imperative API the AI panel drives.
  function makeApi() {
    return {
      getValue: () => editorRef.current?.getModel()?.getValue() ?? "",
      getSelection: () => {
        const ed = editorRef.current;
        const sel = ed?.getSelection();
        if (!ed || !sel || sel.isEmpty()) return "";
        return ed.getModel().getValueInRange(sel);
      },

      // Insert a snippet at the cursor, always on its own line(s).
      insertSuggestion: (text) => {
        const ed = editorRef.current;
        const mono = monacoRef.current;
        if (!ed || !mono || !text) return;
        const model = ed.getModel();
        const sel = ed.getSelection();
        const start = sel.getStartPosition();

        const prefix = start.column > 1 ? "\n" : ""; // don't glue to the left
        const endOffset = model.getOffsetAt(sel.getEndPosition());
        const next = model.getValue().slice(endOffset, endOffset + 1);
        const suffix = next && next !== "\n" ? "\n" : ""; // or to the right
        const payload = prefix + text.trimEnd() + suffix;

        ed.executeEdits("ai", [
          { range: sel, text: payload, forceMoveMarkers: true },
        ]);
        const end = ed.getPosition();
        const range = new mono.Range(
          start.lineNumber,
          start.column,
          end.lineNumber,
          end.column,
        );
        const deco = ed.deltaDecorations(
          [],
          [{ range, options: { className: "ai-suggestion" } }],
        );
        suggestionRef.current = { type: "insert", range, deco };
        ed.revealRangeInCenter(range);
      },

      // Replace the whole file (whole-file fixes / rewrites).
      replaceFile: (text) => {
        const ed = editorRef.current;
        const mono = monacoRef.current;
        if (!ed || !mono) return;
        const model = ed.getModel();
        const oldText = model.getValue();
        const full = new mono.Range(
          1,
          1,
          model.getLineCount(),
          model.getLineMaxColumn(model.getLineCount()),
        );
        ed.executeEdits("ai", [{ range: full, text, forceMoveMarkers: true }]);
        suggestionRef.current = { type: "replace", oldText };
      },

      acceptSuggestion: () => {
        const ed = editorRef.current;
        if (!ed || !suggestionRef.current) return;
        if (suggestionRef.current.deco)
          ed.deltaDecorations(suggestionRef.current.deco, []);
        suggestionRef.current = null;
      },

      rejectSuggestion: () => {
        const ed = editorRef.current;
        const mono = monacoRef.current;
        if (!ed || !mono || !suggestionRef.current) return;
        const s = suggestionRef.current;
        if (s.deco) ed.deltaDecorations(s.deco, []);
        if (s.type === "replace") {
          const model = ed.getModel();
          const full = new mono.Range(
            1,
            1,
            model.getLineCount(),
            model.getLineMaxColumn(model.getLineCount()),
          );
          ed.executeEdits("ai-reject", [
            { range: full, text: s.oldText, forceMoveMarkers: true },
          ]);
        } else {
          ed.executeEdits("ai-reject", [{ range: s.range, text: "" }]);
        }
        suggestionRef.current = null;
      },
    };
  }

  // ---- Yjs binding ----
  useEffect(() => {
    if (!mounted || !file || !token || !editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("monaco");
    const provider = new SocketIOProvider(BASE, file.id, ydoc, {
      autoConnect: true,
      auth: { token },
    });

    // Neon JWTs live 15 minutes, and the /yjs|… namespace refuses a stale one in
    // its authenticate hook. Keep the handshake token fresh so a reconnect is
    // never rejected — and refresh on a refused attempt so the auto-retry works.
    provider.socket.auth = { token };
    const refreshAuth = async () => {
      try {
        const fresh = await getToken();
        if (fresh) provider.socket.auth = { token: fresh };
      } catch {
        /* keep the previous token */
      }
    };
    const authTimer = setInterval(refreshAuth, 10 * 60 * 1000);
    const onConnectError = (err) => {
      if (/unauthoriz|jwt|token/i.test(err?.message || "")) refreshAuth();
    };
    provider.socket.on("connect_error", onConnectError);

    provider.awareness.setLocalStateField("user", {
      name: user?.name || user?.email || "User",
      color: pickColor(user?.id || ""),
    });

    const binding = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness,
    );

    const onAware = () => {
      applyCursorStyles(provider.awareness);
      onAwareness?.(
        Array.from(provider.awareness.getStates().values())
          .map((s) => s.user)
          .filter(Boolean),
      );
    };
    provider.awareness.on("change", onAware);
    onAware();

    let saveTimer;
    const persist = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        apiFetch(`/api/files/${file.id}`, {
          method: "PATCH",
          body: { content: ytext.toString() },
        }).catch(() => {});
      }, 1200);
    };
    ytext.observe(persist);

    return () => {
      clearTimeout(saveTimer);
      clearInterval(authTimer);
      provider.socket.off("connect_error", onConnectError);
      ytext.unobserve(persist);
      provider.awareness.off("change", onAware);
      binding.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [mounted, file?.id, token, user?.id]);

  // ---- diagnostics ----
  useEffect(() => {
    if (!mounted || !file || !editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    const mono = monacoRef.current;
    if (!model || !mono) return;
    const language = langFromPath(file.path);
    if (!DIAG_LANGS.has(language)) return;

    let timer;
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const { markers } = await apiFetch("/api/diagnostics", {
            method: "POST",
            body: { projectId, language, code: model.getValue() },
          });
          mono.editor.setModelMarkers(model, "diagnostics", markers || []);
        } catch {
          /* transient */
        }
      }, 900);
    };
    const sub = model.onDidChangeContent(check);
    check();
    return () => {
      clearTimeout(timer);
      sub.dispose();
      mono.editor.setModelMarkers(model, "diagnostics", []);
    };
  }, [mounted, file?.id, projectId]);

  return (
    <MonacoEditor
      height="100%"
      path={file?.path}
      theme="cyber"
      beforeMount={(mono) => mono.editor.defineTheme("cyber", CYBER_THEME)}
      onMount={(editor, mono) => {
        editorRef.current = editor;
        monacoRef.current = mono;
        if (!inlineRegistered) {
          inlineRegistered = true;
          registerInline(mono);
        }
        setMounted(true);
        onReady?.(makeApi()); // publish the API upward
      }}
      onChange={(value) => onCode?.(value ?? "")}
      options={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 13.5,
        fontLigatures: true,
        minimap: { enabled: false },
        smoothScrolling: true,
        cursorBlinking: "phase",
        cursorSmoothCaretAnimation: "on",
        renderLineHighlight: "all",
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        automaticLayout: true,
        inlineSuggest: { enabled: true },
      }}
    />
  );
}
