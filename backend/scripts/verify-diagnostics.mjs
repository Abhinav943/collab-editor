import { getSandbox, killSandbox, runCommand } from "../src/sandbox/sandbox.js";
import { LANGUAGES } from "../src/lib/languages.js";
import { parseDiagnostics } from "../src/lib/diagnostics.js";

const projectId = "diag-" + Date.now();
await getSandbox(projectId); // creates + bootstraps the sandbox

const cases = [
  ["c", "int main() { return x; }"],
  ["cpp", "int main() { return 0 }"],
  ["java", "public class Main { int x = ; }"],
  ["python", "def f(\n    pass"],
  ["go", "package main\nfunc main() { x := }"],
  ["javascript", "const x = ;"],
];

try {
  for (const [language, code] of cases) {
    const def = LANGUAGES[language];
    const path = `/home/user/${def.defaultFile}`;
    const cmd = def.check.replace("{file}", path);

    // write via the sandbox handle we already have
    const sbx = await getSandbox(projectId);
    await sbx.files.write(path, code);

    const r = await runCommand(projectId, cmd);
    const output = `${r.stdout || ""}${r.stderr || ""}`;
    const markers = parseDiagnostics(language, output);

    console.log(
      `\n${language} (exit ${r.exitCode}) -> ${markers.length} marker(s)`,
    );
    markers.forEach((m) =>
      console.log(
        `  line ${m.startLineNumber}:${m.startColumn} [${m.severity}] ${m.message}`,
      ),
    );
  }
} finally {
  await killSandbox(projectId);
}
console.log("\nDIAGNOSTICS VERIFY DONE");
