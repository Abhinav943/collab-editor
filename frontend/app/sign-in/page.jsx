"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth";
import { GoogleIcon } from "@/components/icons";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const call =
        mode === "signin" ? authClient.signIn.email : authClient.signUp.email;
      const res = await call({ email, password, name: email.split("@")[0] });
      if (res?.error)
        throw new Error(res.error.message || "Authentication failed");
      router.push("/projects");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/projects",
      });
    } catch (err) {
      setError(err.message || "Google sign-in failed");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card panel fade-up">
        <h1>Welcome</h1>
        <p className="sub">Sign in to collaborate on code.</p>

        <div className="seg">
          <button
            className={mode === "signin" ? "on" : ""}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            className={mode === "signup" ? "on" : ""}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        <button className="btn btn-oauth" onClick={google} type="button">
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="divider">or</div>

        <form className="auth-form" onSubmit={submit}>
          <input
            className="field"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="err">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
