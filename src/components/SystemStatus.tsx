"use client";

import { useEffect, useState } from "react";

type Status = {
  database: { connected: boolean };
  worker: {
    healthy: boolean;
    lastSeenAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
  };
  router:
    | { mode: "simulation"; connected: false; message: string }
    | { mode: "mikrotik"; connected: true; boardName: string; version: string; uptime: string; cpuLoad: string }
    | { mode: "mikrotik"; connected: false; message: string };
  configuration: {
    mikrotikEnabled: boolean;
    childSubnet: string | null;
    tokenMinutes: number;
  };
  counts: {
    children: number;
    devices: number;
    activeSessions: number;
  };
};

function relativeTime(iso: string | null) {
  if (!iso) return "jamais";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.floor(minutes / 60)} h`;
}

export default function SystemStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/parent/system/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Diagnostic impossible");
      setStatus(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Diagnostic impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="card stack">
      <div className="sectionTitle inlineTitle">
        <div>
          <span className="eyebrow">DIAGNOSTIC</span>
          <h2>État du système</h2>
        </div>
        <button className="ghost small" disabled={loading} onClick={() => void refresh()}>
          {loading ? "Vérification..." : "Actualiser"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {status && (
        <>
          <div className="healthGrid">
            <div className="healthItem">
              <span className={status.database.connected ? "healthDot ok" : "healthDot bad"} />
              <div><strong>Base de données</strong><p>{status.database.connected ? "Connectée" : "Indisponible"}</p></div>
            </div>

            <div className="healthItem">
              <span className={status.worker.healthy ? "healthDot ok" : "healthDot bad"} />
              <div>
                <strong>Worker réseau</strong>
                <p>{status.worker.healthy ? `Actif · ${relativeTime(status.worker.lastSeenAt)}` : "Inactif ou pas encore démarré"}</p>
              </div>
            </div>

            <div className="healthItem">
              <span className={status.router.connected ? "healthDot ok" : status.configuration.mikrotikEnabled ? "healthDot bad" : "healthDot warn"} />
              <div>
                <strong>MikroTik</strong>
                <p>
                  {status.router.connected
                    ? `${"boardName" in status.router ? status.router.boardName : "MikroTik"} connecté`
                    : status.configuration.mikrotikEnabled
                      ? "Configuré mais inaccessible"
                      : "Mode simulation"}
                </p>
              </div>
            </div>
          </div>

          <div className="stats">
            <span>{status.counts.children} enfant(s)</span>
            <span>{status.counts.devices} appareil(s)</span>
            <span>{status.counts.activeSessions} session(s) active(s)</span>
            <span>1 jeton = {status.configuration.tokenMinutes} min</span>
            {status.configuration.childSubnet && <span>Réseau : {status.configuration.childSubnet}</span>}
          </div>

          {status.worker.lastError && <div className="error">Worker : {status.worker.lastError}</div>}
        </>
      )}
    </section>
  );
}
