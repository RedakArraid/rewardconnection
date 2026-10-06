"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeviceActions({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mutate(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    try {
      const response = await fetch(`/api/parent/devices/${id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        window.alert(data.error || "Action impossible");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="actions">
      <button
        className="ghost small"
        disabled={busy}
        onClick={() => mutate("PATCH", { enabled: !enabled })}
      >
        {enabled ? "Désactiver" : "Activer"}
      </button>
      <button
        className="danger small"
        disabled={busy}
        onClick={() => {
          if (window.confirm("Supprimer cet appareil ?")) mutate("DELETE");
        }}
      >
        Supprimer
      </button>
    </div>
  );
}
