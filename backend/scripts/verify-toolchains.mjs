import { getSandbox, killSandbox } from "../src/sandbox/sandbox.js";

const projectId = "verify-" + Date.now();
try {
  const sbx = await getSandbox(projectId); // creates AND bootstraps
  const check = await sbx.commands.run(
    'for t in node python3 gcc g++ javac go; do printf "%-8s " $t; command -v $t || echo MISSING; done',
  );
  console.log("toolchains:\n" + check.stdout);
} finally {
  await killSandbox(projectId);
}
