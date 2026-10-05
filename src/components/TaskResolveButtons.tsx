"use client";

import { useRouter } from "next/navigation";

export default function TaskResolveButtons({ id }: { id: string }) {
  const router = useRouter();
  async function resolve(approved: boolean) {
    await fetch(`/api/parent/tasks/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    router.refresh();
  }
  return <div className="actions"><button className="primary small" onClick={() => resolve(true)}>Valider</button><button className="ghost small" onClick={() => resolve(false)}>Refuser</button></div>;
}
