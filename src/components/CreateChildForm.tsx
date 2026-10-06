"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateChildForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/parent/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        password: data.get("password"),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Création impossible");
      return;
    }
    form.reset();
    setMessage("Compte enfant créé.");
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h3>Créer un compte enfant</h3>
      <label>Prénom<input name="name" required /></label>
      <label>Email / identifiant<input name="email" type="email" required placeholder="adam@maison.local" /></label>
      <label>Mot de passe<input name="password" type="password" minLength={8} required /></label>
      <button className="secondary">Créer l'enfant</button>
      {message && <div className="notice">{message}</div>}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
