"use client";

import { useRouter } from "next/navigation";

export default function ClaimTaskButton({ id }: { id: string }) {
  const router = useRouter();
  return <button className="secondary small" onClick={async () => {
    await fetch(`/api/child/tasks/${id}/claim`, { method: "POST" });
    router.refresh();
  }}>J'ai terminé</button>;
}
