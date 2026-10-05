import { redirect } from "next/navigation";
import { requireChild } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import ChildActions from "@/components/ChildActions";
import ClaimTaskButton from "@/components/ClaimTaskButton";

function remaining(expiresAt: Date) {
  const ms = Math.max(0, expiresAt.getTime() - Date.now());
  const total = Math.ceil(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default async function ChildPage() {
  let child;
  try { child = await requireChild(); } catch { redirect("/login"); }

  const [wallet, active, tasks, txs, devices] = await Promise.all([
    prisma.tokenWallet.findUnique({ where: { userId: child.id } }),
    prisma.internetSession.findFirst({ where: { userId: child.id, status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" } }),
    prisma.householdTask.findMany({ where: { childId: child.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.tokenTransaction.findMany({ where: { userId: child.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.device.findMany({ where: { userId: child.id }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <main className="appShell childTheme">
      <header className="topbar">
        <div><span className="eyebrow">ESPACE ENFANT</span><h1>Salut {child.name} 👋</h1></div>
        <LogoutButton />
      </header>

      <section className="internetCard">
        <span className="eyebrow">MON TEMPS INTERNET</span>
        <div className="tokenCount">🪙 {wallet?.balance ?? 0}</div>
        <div className="timer">{active ? remaining(active.expiresAt) : "00:00"}</div>
        <p>{active ? "Internet est actif sur tes appareils" : `Utilise 1 jeton pour ${process.env.TOKEN_MINUTES || 60} minutes`}</p>
        <ChildActions active={Boolean(active)} />
      </section>

      <section>
        <div className="sectionTitle"><h2>Mes missions</h2></div>
        <div className="stack">
          {tasks.filter(t => t.status !== "APPROVED").map(task => (
            <article className="card taskRow" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p>{task.description || "Mission de la maison"} · +{task.reward} 🪙</p>
                <span className="badge">{task.status === "CLAIMED" ? "En attente du parent" : task.status === "REJECTED" ? "À refaire" : "À faire"}</span>
              </div>
              {(task.status === "OPEN" || task.status === "REJECTED") && <ClaimTaskButton id={task.id} />}
            </article>
          ))}
          {tasks.filter(t => t.status !== "APPROVED").length === 0 && <div className="card empty">Toutes tes missions sont terminées 🎉</div>}
        </div>
      </section>

      <section className="grid2">
        <div>
          <div className="sectionTitle"><h2>Mes appareils</h2></div>
          <div className="stack">
            {devices.map(d => <div className="card taskRow" key={d.id}><strong>{d.name}</strong><span className="badge success">{d.enabled ? "Autorisé" : "Désactivé"}</span></div>)}
            {!devices.length && <div className="card empty">Aucun appareil enregistré.</div>}
          </div>
        </div>
        <div>
          <div className="sectionTitle"><h2>Mes jetons</h2></div>
          <div className="stack">
            {txs.map(t => <div className="card taskRow" key={t.id}><div><strong>{t.reason || t.type}</strong><p>{t.createdAt.toLocaleDateString("fr-FR")}</p></div><strong className={t.amount > 0 ? "online" : ""}>{t.amount > 0 ? "+" : ""}{t.amount} 🪙</strong></div>)}
          </div>
        </div>
      </section>
    </main>
  );
}
