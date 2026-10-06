"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("parent@demo.local");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Connexion impossible");
    router.push(data.role === "PARENT" ? "/parent" : "/child");
    router.refresh();
  }

  return (
    <main className="authShell">
      <section className="authCard">
        <div className="brandMark">RC</div>
        <h1>RewardConnection</h1>
        <p className="muted">Les efforts deviennent du temps Internet.</p>
        <form onSubmit={submit} className="stack">
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
          <label>Mot de passe<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>{busy ? "Connexion..." : "Se connecter"}</button>
        </form>
        <div className="demoBox">
          <strong>Démo</strong>
          <span>Parent : parent@demo.local / demo1234</span>
          <span>Enfant : enfant@demo.local / demo1234</span>
        </div>
      </section>
    </main>
  );
}
