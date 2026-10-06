"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function FamilySettings({
  familyName,
  tokenMinutes,
}: {
  familyName: string;
  tokenMinutes: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/parent/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyName: form.get("familyName"),
          tokenMinutes: Number(form.get("tokenMinutes")),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Impossible d'enregistrer les réglages");
        return;
      }
      setMessage("Réglages enregistrés.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <div>
        <span className="eyebrow">RÉGLAGES FAMILLE</span>
        <h3>Règles des jetons</h3>
        <p className="muted smallText">
          La durée s'applique aux prochaines sessions. Une session déjà démarrée conserve sa durée actuelle.
        </p>
      </div>
      <form className="settingsGrid" onSubmit={submit}>
        <label>
          Nom de la famille
          <input name="familyName" defaultValue={familyName} minLength={2} maxLength={80} required />
        </label>
        <label>
          Minutes par jeton
          <input name="tokenMinutes" type="number" min="5" max="1440" step="5" defaultValue={tokenMinutes} required />
        </label>
        <button className="primary" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
      </form>
      {message && <div className="notice">{message}</div>}
      {error && <div className="error">{error}</div>}
    </section>
  );
}
