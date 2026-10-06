"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TaskResolveButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resolve(approved: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`/api/parent/tasks/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (!response.ok) {
        const data = await response.json();
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
      <button className="primary small" disabled={busy} onClick={() => resolve(true)}>Valider</button>
      <button className="ghost small" disabled={busy} onClick={() => resolve(false)}>Refuser</button>
    </div>
  );
}
