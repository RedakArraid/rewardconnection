"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Child = { id: string; name: string };

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erreur");
  return data;
}

export default function ParentActions({ children }: { children: Child[] }) {
  const router = useRouter();
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    try {
      setMessage("");
      setError("");
      await action();
      setMessage("Action enregistrée.");
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur");
      return false;
    }
  }

  if (!children.length) return <div className="card">Crée d'abord un compte enfant.</div>;

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run(() => post("/api/parent/tasks", {
      childId,
      title: String(data.get("title")),
      description: String(data.get("description") || ""),
      reward: Number(data.get("reward") || 1),
    }));
    if (ok) form.reset();
  }

  async function submitDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run(() => post("/api/parent/devices", {
      childId,
      name: String(data.get("name")),
      ipAddress: String(data.get("ipAddress")),
      macAddress: String(data.get("macAddress")),
    }));
    if (ok) form.reset();
  }

  return (
    <div className="stack">
      <div className="card compact">
        <div className="fieldRow">
          <label>
            Enfant
            <select value={childId} onChange={(event) => setChildId(event.target.value)}>
              {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
            </select>
          </label>
          <button className="primary small" onClick={() => run(() => post("/api/parent/tokens", {
            childId,
            amount: 1,
            reason: "Jeton donné par un parent",
          }))}>+1 jeton</button>
          <button className="danger small" onClick={() => run(() => post("/api/parent/internet/stop", { childId }))}>Couper Internet</button>
        </div>
        {message && <div className="notice">{message}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="grid2">
        <form className="card stack" onSubmit={submitTask}>
          <h3>Nouvelle mission</h3>
          <label>Titre<input name="title" required placeholder="Ranger sa chambre" /></label>
          <label>Description<textarea name="description" placeholder="Optionnel" /></label>
          <label>
            Récompense
            <select name="reward" defaultValue="1">
              <option value="1">1 jeton</option>
              <option value="2">2 jetons</option>
              <option value="3">3 jetons</option>
            </select>
          </label>
          <button className="primary">Créer la mission</button>
        </form>

        <form className="card stack" onSubmit={submitDevice}>
          <h3>Ajouter un appareil manuellement</h3>
          <p className="muted smallText">Le scan DHCP MikroTik est recommandé. En ajout manuel, utilise une réservation DHCP fixe.</p>
          <label>Nom<input name="name" required placeholder="iPhone Adam" /></label>
          <label>IPv4 fixe<input name="ipAddress" required placeholder="192.168.20.21" /></label>
          <label>Adresse MAC<input name="macAddress" required placeholder="AA:BB:CC:DD:EE:FF" /></label>
          <button className="secondary">Ajouter l'appareil</button>
        </form>
      </div>
    </div>
  );
}
