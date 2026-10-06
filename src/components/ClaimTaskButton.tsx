"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClaimTaskButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button className="secondary small" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/child/tasks/${id}/claim`, { method: "POST" });
        if (!response.ok) {
          const data = await response.json();
          window.alert(data.error || "Action impossible");
          return;
        }
        router.refresh();
      } finally {
        setBusy(false);
      }
    }}>{busy ? "Envoi..." : "J'ai terminé"}</button>
  );
}
