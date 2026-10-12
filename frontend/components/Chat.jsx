"use client";
import { useEffect, useRef, useState } from "react";

export default function Chat({ socket, projectId, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const join = () => socket.emit("project:join", { projectId });
    join(); // join now…
    socket.on("connect", join); // …and again after every reconnect

    const onHistory = ({ messages }) => setMessages(messages || []);
    const onMessage = (m) => setMessages((prev) => [...prev, m]);
    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);

    return () => {
      socket.off("connect", join);
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.emit("project:leave", { projectId });
    };
  }, [socket, projectId]);

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !socket) return;
    socket.emit("chat:send", { projectId, text: body });
    setText("");
  }

  return (
    <div className="pane chat">
      <div className="pane-head">
        <span>Chat</span>
        <span className="tag">{messages.length}</span>
      </div>

      <div className="chat-list" ref={listRef}>
        {messages.map((m) => {
          const mine = m.user?.id === user?.id;
          return (
            <div key={m.id} className={`bubble-row${mine ? " mine" : ""}`}>
              <div className={`bubble${mine ? " mine" : ""}`}>
                <span className="bubble-author">
                  {mine ? "You" : m.user?.name || "Guest"}
                </span>
                <span className="bubble-text">{m.text}</span>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="empty" style={{ padding: "14px 4px" }}>
            No messages yet.
          </p>
        )}
      </div>

      <form className="row2" onSubmit={send}>
        <input
          className="field"
          placeholder="Message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
