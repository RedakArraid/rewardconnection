"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Child = { id: string; name: string; email: string };

export default function ChildAccountManager({ children }: { children: Child[] }) {
  const router = useRouter();
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => children.find((child) => child.id === childId) || children[0],
    [children, childId],
  );

  if (!children.length) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const data = new FormData(form);
      const payload: Record<string, string> = {};
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");

      if (name && name !== selected?.name) payload.name = name;
      if (email && email !== selected?.email) payload.email = email;
      if (password) payload.password = password;

      if (!Object.keys(payload).length) {
        setError("Aucune modification à enregistrer.");
        return;
      }

      const response = await fetch(`/api/parent/children/${childId}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "Modification impossible");
        return;
      }

      form.reset();
      setMessage("Compte enfant mis à jour.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit} key={selected?.id}>
      <div>
        <span className="eyebrow">COMPTE ENFANT</span>
        <h3>Modifier ou réinitialiser</h3>
      </div>

      <label>
        Enfant
        <select value={childId} onChange={(event) => setChildId(event.target.value)}>
          {children.map((child) => (
            <option key={child.id} value={child.id}>{child.name}</option>
          ))}
        </select>
      </label>

      <label>
        Prénom
        <input name="name" defaultValue={selected?.name || ""} minLength={2} maxLength={80} />
      </label>

      <label>
        Email / identifiant
        <input name="email" type="email" defaultValue={selected?.email || ""} />
      </label>

      <label>
        Nouveau mot de passe
        <input name="password" type="password" minLength={8} placeholder="Laisser vide pour conserver l'actuel" />
      </label>

      <button className="secondary" disabled={busy}>
        {busy ? "Enregistrement..." : "Enregistrer"}
      </button>

      {message && <div className="notice">{message}</div>}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
