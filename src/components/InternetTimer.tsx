"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function format(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function InternetTimer({
  expiresAt,
  initialSeconds,
}: {
  expiresAt: string | null;
  initialSeconds: number;
}) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(initialSeconds);
  const refreshed = useRef(false);

  useEffect(() => {
    if (!expiresAt) {
      setSeconds(0);
      return;
    }

    const tick = () => {
      const next = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
      setSeconds(next);
      if (next === 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, router]);

  return <div className="timer" suppressHydrationWarning>{format(seconds)}</div>;
}
