"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ChildActions({
  active,
  canActivate,
}: {
  active: boolean;
  canActivate: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/child/internet/activate", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Impossible d'activer Internet");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || active || !canActivate;
  const label = active
    ? "Internet déjà actif"
    : !canActivate
      ? "Aucun appareil configuré"
      : busy
        ? "Activation..."
        : "Utiliser 1 jeton";

  return <>
    <button className="primary big" disabled={disabled} onClick={activate}>{label}</button>
    {error && <div className="error">{error}</div>}
  </>;
}
