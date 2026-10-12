/**
 * Supported languages for the editor.
 *
 * label       - human name shown in the UI
 * extensions  - file extensions that map to this language
 * monaco      - Monaco's language id (drives highlighting + built-in workers)
 * defaultFile - temp filename used when compiling for diagnostics
 * check       - command run in the sandbox to produce diagnostics.
 *               "{file}" is replaced with the temp file path.
 */
export const LANGUAGES = {
  javascript: {
    label: "JavaScript",
    extensions: [".js", ".mjs", ".cjs"],
    monaco: "javascript",
    defaultFile: "main.js",
    check: "node --check {file}",
  },
  c: {
    label: "C",
    extensions: [".c"],
    monaco: "c",
    defaultFile: "main.c",
    check: "gcc -fsyntax-only -Wall {file}",
  },
  cpp: {
    label: "C++",
    extensions: [".cpp", ".cc", ".cxx", ".hpp"],
    monaco: "cpp",
    defaultFile: "main.cpp",
    check: "g++ -fsyntax-only -std=c++17 -Wall {file}",
  },
  java: {
    label: "Java",
    extensions: [".java"],
    monaco: "java",
    defaultFile: "Main.java",
    check: "javac -Xlint:all -d /tmp {file}",
  },
  python: {
    label: "Python",
    extensions: [".py"],
    monaco: "python",
    defaultFile: "main.py",
    check: "python3 -m py_compile {file}",
  },
  go: {
    label: "Go",
    extensions: [".go"],
    monaco: "go",
    defaultFile: "main.go",
    check: "gofmt -e {file}",
  },
};

/** Pick a language id from a file path. Falls back to plaintext. */
export function detectLanguage(path = "") {
  const p = path.toLowerCase();
  for (const [id, def] of Object.entries(LANGUAGES)) {
    if (def.extensions.some((ext) => p.endsWith(ext))) return id;
  }
  return "plaintext";
}

/** Public shape for the client (no shell commands leaked to the browser). */
export function publicLanguages() {
  return Object.entries(LANGUAGES).map(([id, def]) => ({
    id,
    label: def.label,
    extensions: def.extensions,
    monaco: def.monaco,
  }));
}

/** Single-quote a value for POSIX sh. */
export function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

/**
 * Reduce an arbitrary string to a safe basename. Stops path traversal and shell
 * metacharacters from ever reaching the sandbox filesystem or a shell command.
 */
export function safeFileName(name, fallback = "main.txt") {
  const base = String(name || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return base || fallback;
}

/** Temp filename for a language (Java must match its public class). */
export function fileNameFor(language, code, given) {
  if (given)
    return safeFileName(given, LANGUAGES[language]?.defaultFile || "main.txt");
  if (language === "java") {
    const m = code.match(/class\s+(\w+)/);
    return `${m ? m[1] : "Main"}.java`;
  }
  return LANGUAGES[language]?.defaultFile || "main.txt";
}

/** Shell command that compiles and runs the file (single-file, demo-grade). */
export function buildRunCommand(language, path, code) {
  const p = shellQuote(path);
  switch (language) {
    case "python":
      return `python3 ${p}`;
    case "javascript":
      return `node ${p}`;
    case "go":
      return `go run ${p}`;
    case "c":
      return `gcc ${p} -o /tmp/a.out -lm && /tmp/a.out`;
    case "cpp":
      return `g++ ${p} -o /tmp/a.out && /tmp/a.out`;
    case "java": {
      const cls = (code.match(/class\s+(\w+)/) || [null, "Main"])[1];
      return `javac -d /tmp ${p} && java -cp /tmp ${shellQuote(cls)}`;
    }
    default:
      return `cat ${p}`;
  }
}
