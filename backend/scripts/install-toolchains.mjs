import { Sandbox } from "e2b";

const sandbox = await Sandbox.create({ timeoutMs: 600_000 });
try {
  console.log("sandbox:", sandbox.sandboxId);

  const before = await sandbox.commands.run(
    'for t in gcc g++ javac go; do printf "%-8s " $t; command -v $t || echo MISSING; done',
  );
  console.log("before:\n" + before.stdout);

  console.log("installing openjdk + go (this takes a minute)...");
  const install = await sandbox.commands.run(
    "sudo apt-get update -qq && sudo apt-get install -y -qq openjdk-17-jdk-headless golang-go",
    { timeoutMs: 480_000 },
  );
  console.log("install exit code:", install.exitCode);
  console.log(install.stdout.slice(-400));

  const after = await sandbox.commands.run(
    'for t in gcc g++ javac go; do printf "%-8s " $t; command -v $t || echo MISSING; done',
  );
  console.log("after:\n" + after.stdout);
} finally {
  await sandbox.kill();
}
