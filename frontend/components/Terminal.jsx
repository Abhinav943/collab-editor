"use client";
import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export default function Terminal({ socket, projectId }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !socket) return;

    let disposed = false;
    let started = false;
    const subs = [];

    const term = new XTerm({
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: "#0a0c17",
        foreground: "#dce7ff",
        cursor: "#22e0ff",
        selectionBackground: "#22e0ff33",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    const safeFit = () => {
      if (disposed || !host.clientWidth || !host.clientHeight) return;
      try {
        fit.fit();
      } catch {
        /* not ready yet */
      }
    };

    // Hoisted out of openWhenReady so cleanup can actually remove them.
    const start = () => {
      if (disposed) return;
      started = true;
      socket.emit("terminal:start", {
        projectId,
        cols: term.cols,
        rows: term.rows,
      });
    };
    const onDisconnect = () => {
      started = false;
    };

    // xterm throws "reading 'dimensions'" if opened before the container has
    // a real size, so wait for layout first.
    const openWhenReady = () => {
      if (disposed) return;
      if (!host.clientWidth || !host.clientHeight) {
        requestAnimationFrame(openWhenReady);
        return;
      }
      term.open(host);
      safeFit();

      subs.push(term.onData((d) => socket.emit("terminal:input", { data: d })));

      if (socket.connected) start();
    };

    socket.on("connect", start); // (re)start after any reconnect
    socket.on("disconnect", onDisconnect); // allow a fresh start

    const onData = ({ data }) => {
      if (!disposed) term.write(data);
    };
    const onExit = ({ exitCode }) => {
      if (!disposed)
        term.write(
          `\r\n\x1b[38;5;245m[process exited: ${exitCode}]\x1b[0m\r\n`,
        );
    };
    socket.on("terminal:data", onData);
    socket.on("terminal:exit", onExit);

    const ro = new ResizeObserver(() => {
      safeFit();
      if (started && !disposed)
        socket.emit("terminal:resize", { cols: term.cols, rows: term.rows });
    });
    ro.observe(host);

    const raf = requestAnimationFrame(openWhenReady);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      subs.forEach((s) => s.dispose());
      socket.off("connect", start);
      socket.off("disconnect", onDisconnect);
      socket.off("terminal:data", onData);
      socket.off("terminal:exit", onExit);
      socket.emit("terminal:stop");
      try {
        term.dispose();
      } catch {}
    };
  }, [socket, projectId]);

  return <div className="term-host" ref={hostRef} />;
}
