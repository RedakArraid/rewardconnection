"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Child = { id: string; name: string };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur");
  return data;
}

export default function ParentActions({ children }: { children: Child[] }) {
  const router = useRouter();
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [message, setMessage] = useState("");

  async function run(fn: () => Promise<unknown>) {
    try { setMessage(""); await fn(); setMessage("Action enregistrée"); router.refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Erreur"); }
  }

  if (!children.length) return <div className="card">Aucun compte enfant.</div>;

  return (
    <div className="stack">
      <div className="card compact">
        <div className="fieldRow">
          <label>Enfant<select value={childId} onChange={(e) => setChildId(e.target.value)}>{children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <button className="primary small" onClick={() => run(() => post("/api/parent/tokens", { childId, amount: 1, reason: "Jeton parent" }))}>+1 jeton</button>
          <button className="danger small" onClick={() => run(() => post("/api/parent/internet/stop", { childId }))}>Couper Internet</button>
        </div>
        {message && <div className="notice">{message}</div>}
      </div>

      <div className="grid2">
        <form className="card stack" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => post("/api/parent/tasks", {
            childId, title: String(fd.get("title")), description: String(fd.get("description") || ""), reward: Number(fd.get("reward") || 1),
          }));
          e.currentTarget.reset();
        }}>
          <h3>Nouvelle mission</h3>
          <label>Titre<input name="title" required placeholder="Ranger sa chambre" /></label>
          <label>Description<textarea name="description" placeholder="Optionnel" /></label>
          <label>Récompense<select name="reward" defaultValue="1"><option value="1">1 jeton</option><option value="2">2 jetons</option><option value="3">3 jetons</option></select></label>
          <button className="primary">Créer la mission</button>
        </form>

        <form className="card stack" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => post("/api/parent/devices", {
            childId, name: String(fd.get("name")), ipAddress: String(fd.get("ipAddress") || ""), macAddress: String(fd.get("macAddress") || ""),
          }));
          e.currentTarget.reset();
        }}>
          <h3>Ajouter un appareil</h3>
          <label>Nom<input name="name" required placeholder="iPhone Adam" /></label>
          <label>IP fixe / réservation DHCP<input name="ipAddress" placeholder="192.168.20.21" /></label>
          <label>Adresse MAC<input name="macAddress" placeholder="AA:BB:CC:DD:EE:FF" /></label>
          <button className="secondary">Ajouter l'appareil</button>
        </form>
      </div>
    </div>
  );
}
