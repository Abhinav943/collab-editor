const EXT_LANG = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  java: "java",
  py: "python",
  go: "go",
};

export function langFromPath(path = "") {
  const name = String(path).split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "plaintext"; // no extension, or a dotfile
  return EXT_LANG[name.slice(dot + 1).toLowerCase()] || "plaintext";
}
