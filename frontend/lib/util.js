const COLORS = [
  "#22e0ff",
  "#ff3ea5",
  "#8b5cf6",
  "#a6ff1f",
  "#ffb020",
  "#34e08a",
];

/** Stable colour per user id, so a person's cursor is always the same colour. */
export function pickColor(id = "") {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function initials(name = "") {
  return name.trim().slice(0, 2).toUpperCase() || "??";
}
