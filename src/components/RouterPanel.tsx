"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Child = { id: string; name: string };
type RouterState =
  | { mode: "simulation"; connected: false; message: string }
  | { mode: "mikrotik"; connected: true; boardName: string; version: string; uptime: string; cpuLoad: string };

type Lease = {
  id: string;
  address: string;
  macAddress: string;
  hostName: string | null;
  status: string;
  dynamic: boolean;
  lastSeen: string | null;
  assigned: { deviceId: string; userId: string; name: string } | null;
};

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erreur réseau");
  return data;
}

export default function RouterPanel({ children }: { children: Child[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<RouterState | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function check() {
    try {
      setBusy(true);
      setMessage("");
      setStatus(await jsonFetch("/api/parent/router/status"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Routeur inaccessible");
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    try {
      setBusy(true);
      setMessage("");
      const data = await jsonFetch("/api/parent/router/leases");
      setLeases(data.leases || []);
      if (!(data.leases || []).length) setMessage("Aucun appareil DHCP trouvé dans le réseau enfants.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scan impossible");
    } finally {
      setBusy(false);
    }
  }

  async function assign(lease: Lease) {
    if (!childId) return;
    try {
      setBusy(true);
      setMessage("");
      await jsonFetch("/api/parent/router/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          leaseId: lease.id,
          name: lease.hostName || undefined,
        }),
      });
      setMessage("Appareil associé et bail DHCP rendu statique.");
      await scan();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Association impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <div className="sectionTitle inlineTitle">
        <div>
          <span className="eyebrow">MIKROTIK</span>
          <h2>Réseau enfants</h2>
        </div>
        <div className="actions">
          <button className="ghost small" disabled={busy} onClick={check}>Tester</button>
          <button className="secondary small" disabled={busy} onClick={scan}>Scanner DHCP</button>
        </div>
      </div>

      {status && (
        <div className={status.connected ? "routerStatus successBox" : "routerStatus"}>
          {status.mode === "mikrotik"
            ? <><strong>{status.boardName}</strong><span>RouterOS {status.version} · uptime {status.uptime} · CPU {status.cpuLoad}%</span></>
            : <><strong>Mode simulation</strong><span>{status.message}</span></>}
        </div>
      )}

      {children.length > 0 && leases.length > 0 && (
        <label>
          Associer les nouveaux appareils à
          <select value={childId} onChange={(event) => setChildId(event.target.value)}>
            {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select>
        </label>
      )}

      {leases.map((lease) => (
        <div className="deviceLease" key={lease.id}>
          <div>
            <strong>{lease.hostName || "Appareil sans nom"}</strong>
            <p>{lease.address} · {lease.macAddress} · {lease.status}{lease.dynamic ? " · DHCP dynamique" : " · DHCP statique"}</p>
          </div>
          {lease.assigned
            ? <span className="badge success">Déjà associé</span>
            : <button className="primary small" disabled={busy || !childId} onClick={() => assign(lease)}>Associer</button>}
        </div>
      ))}

      {message && <div className="notice">{message}</div>}
    </section>
  );
}
