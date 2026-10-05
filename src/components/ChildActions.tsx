"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ChildActions({ active }: { active: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true); setError("");
    const res = await fetch("/api/child/internet/activate", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Impossible d'activer Internet");
    router.refresh();
  }

  return <>
    <button className="primary big" disabled={busy || active} onClick={activate}>
      {active ? "Internet déjà actif" : busy ? "Activation..." : "Utiliser 1 jeton"}
    </button>
    {error && <div className="error">{error}</div>}
  </>;
}
