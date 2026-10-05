"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      familyName: fd.get("familyName"), parentName: fd.get("parentName"), email: fd.get("email"), password: fd.get("password")
    })});
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Initialisation impossible");
    router.push("/parent"); router.refresh();
  }
  return <main className="authShell"><section className="authCard">
    <div className="brandMark">RC</div><h1>Configurer RewardConnection</h1>
    <p className="muted">Crée le premier compte parent et la famille.</p>
    <form className="stack" onSubmit={submit}>
      <label>Nom de la famille<input name="familyName" required /></label>
      <label>Nom du parent<input name="parentName" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Mot de passe<input name="password" type="password" minLength={8} required /></label>
      {error && <div className="error">{error}</div>}<button className="primary">Initialiser</button>
    </form>
  </section></main>;
}
