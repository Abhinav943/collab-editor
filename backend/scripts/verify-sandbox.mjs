import { Sandbox } from "e2b";

const sandbox = await Sandbox.create({ timeoutMs: 120_000 });
try {
  console.log("sandbox id:", sandbox.sandboxId);

  const r = await sandbox.commands.run('echo "hello from e2b" && uname -a');
  console.log("stdout:", r.stdout.trim());
  console.log("exitCode:", r.exitCode);

  // Check which compilers the sandbox already has (see note below).
  const tools = await sandbox.commands.run(
    'for t in node python3 gcc g++ javac go; do printf "%-8s " $t; command -v $t || echo MISSING; done',
  );
  console.log("toolchains:\n" + tools.stdout);
} finally {
  await sandbox.kill();
}
console.log("SANDBOX VERIFY OK");
