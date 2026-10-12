import Link from "next/link";

const FEATURES = [
  {
    k: "Live",
    t: "Real-time collaboration",
    d: "Multiple cursors, instant sync, conflict-free edits powered by CRDTs.",
  },
  {
    k: "Shell",
    t: "A real terminal",
    d: "Run commands, feed stdin, and watch output stream in — inside the browser.",
  },
  {
    k: "Compile",
    t: "Real compiler errors",
    d: "C, C++, Java, Python, Go and JS checked by actual compilers, red-lined inline.",
  },
  {
    k: "AI",
    t: "AI that ships",
    d: "Generate, explain, and fix code without ever leaving the editor.",
  },
];

export default function Home() {
  return (
    <main className="landing">
      <section className="hero">
        <span className="badge pulse fade-up">● v1.0 — now with AI</span>
        <h1 className="hero-title fade-up d1">
          Code together.
          <br />
          <span className="gradient-text">At the speed of thought.</span>
        </h1>
        <p className="hero-sub fade-up d2">
          A collaborative, AI-assisted code editor in your browser — live
          multi-user editing, an integrated terminal, real compiler diagnostics,
          and AI help on tap.
        </p>
        <div className="hero-cta fade-up d3">
          <Link className="btn btn-primary" href="/projects">
            Open the editor →
          </Link>
          <Link className="btn btn-ghost" href="/sign-in">
            Sign in
          </Link>
        </div>
      </section>

      <section className="features">
        {FEATURES.map((f, i) => (
          <article className={`card fade-up d${i + 1}`} key={f.k}>
            <div className="card-key mono">{f.k}</div>
            <h3>{f.t}</h3>
            <p>{f.d}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
