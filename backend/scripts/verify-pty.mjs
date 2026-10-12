import { Sandbox } from "e2b";

const sandbox = await Sandbox.create({ timeoutMs: 120_000 });
let out = "";

try {
  const term = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    timeoutMs: 0,
    onData: (d) => {
      out += new TextDecoder().decode(d);
    },
  });
  console.log("pty pid:", term.pid);

  // Run a program that WAITS for input...
  await sandbox.pty.sendInput(
    term.pid,
    new TextEncoder().encode("python3 -c \"x=input(); print('got:', x)\"\n"),
  );
  await new Promise((r) => setTimeout(r, 2500));

  // ...then type the input.
  await sandbox.pty.sendInput(
    term.pid,
    new TextEncoder().encode("hello-input\n"),
  );
  await new Promise((r) => setTimeout(r, 2500));

  console.log("---- terminal output ----\n" + out);

  await sandbox.pty.kill(term.pid);
  if (!out.includes("got: hello-input")) {
    console.error("FAIL: stdin was not received by the program");
    process.exit(1);
  }
  console.log("PTY VERIFY OK");
} finally {
  await sandbox.kill();
}
