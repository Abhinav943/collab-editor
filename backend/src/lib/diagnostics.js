/**
 * Turn compiler/checker output into Monaco markers.
 *
 * Monaco MarkerSeverity: Hint = 1, Info = 2, Warning = 4, Error = 8.
 * Each marker is line/column anchored; a one-character span is enough for
 * Monaco to draw the squiggle under the position.
 */
const SEV = { hint: 1, info: 2, warning: 4, error: 8 };

function marker(line, column, severity, message) {
  const ln = Math.max(1, Number(line) || 1);
  const col = Math.max(1, Number(column) || 1);
  return {
    startLineNumber: ln,
    startColumn: col,
    endLineNumber: ln,
    endColumn: col + 1,
    severity,
    message: String(message).trim(),
  };
}

/** gcc / g++:  /tmp/main.c:3:5: error: 'x' undeclared   (column optional) */
function parseGccLike(output) {
  const markers = [];
  const re =
    /^(.+?):(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note):\s*(.*)$/gm;
  let m;
  while ((m = re.exec(output)) !== null) {
    const kind = m[4];
    const severity = kind.includes("error")
      ? SEV.error
      : kind === "note"
        ? SEV.info
        : SEV.warning;
    markers.push(marker(m[2], m[3] || 1, severity, m[5]));
  }
  return markers;
}

/** javac:  /tmp/Main.java:4: error: ';' expected   (no column) */
function parseJavac(output) {
  const markers = [];
  const re = /^(.+?\.java):(\d+):\s*(error|warning):\s*(.*)$/gm;
  let m;
  while ((m = re.exec(output)) !== null) {
    markers.push(
      marker(m[2], 1, m[3] === "error" ? SEV.error : SEV.warning, m[4]),
    );
  }
  return markers;
}

/** python -m py_compile:  File "main.py", line 3 ... SyntaxError: message */
function parsePython(output) {
  const lines = output.split("\n");
  const markers = [];
  for (let i = 0; i < lines.length; i++) {
    const fm = lines[i].match(/File ".*?", line (\d+)/);
    if (!fm) continue;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const em = lines[j].match(/^(\w*(?:Error|Exception)):\s*(.*)$/);
      if (em) {
        markers.push(marker(fm[1], 1, SEV.error, `${em[1]}: ${em[2]}`));
        break;
      }
    }
  }
  return markers;
}

/** gofmt -e:  /tmp/main.go:5:1: expected declaration, found x */
function parseGo(output) {
  const markers = [];
  const re = /^(.+?\.go):(\d+):(\d+):\s*(.*)$/gm;
  let m;
  while ((m = re.exec(output)) !== null) {
    markers.push(marker(m[2], m[3], SEV.error, m[4]));
  }
  return markers;
}

/** node --check:  main.js:3  (newline)  ... SyntaxError: message */
function parseNode(output) {
  const lines = output.split("\n");
  const markers = [];
  for (let i = 0; i < lines.length; i++) {
    const fm = lines[i].match(/^(.+?\.(?:js|mjs|cjs)):(\d+)$/);
    if (!fm) continue;
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const em = lines[j].match(/^(\w*Error):\s*(.*)$/);
      if (em) {
        markers.push(marker(fm[2], 1, SEV.error, `${em[1]}: ${em[2]}`));
        break;
      }
    }
  }
  return markers;
}

const PARSERS = {
  c: parseGccLike,
  cpp: parseGccLike,
  java: parseJavac,
  python: parsePython,
  go: parseGo,
  javascript: parseNode,
};

/** Parse compiler output for a language into markers. Never throws. */
export function parseDiagnostics(language, output) {
  const parser = PARSERS[language];
  if (!parser || !output) return [];
  try {
    return parser(output);
  } catch {
    return [];
  }
}
