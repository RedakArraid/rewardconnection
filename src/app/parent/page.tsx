import { redirect } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import ParentActions from "@/components/ParentActions";
import TaskResolveButtons from "@/components/TaskResolveButtons";
import CreateChildForm from "@/components/CreateChildForm";

function remaining(expiresAt: Date | null) {
  if (!expiresAt) return "Inactif";
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return "Inactif";
  return `${Math.ceil(ms / 60000)} min restantes`;
}

export default async function ParentPage() {
  let parent;
  try { parent = await requireParent(); } catch { redirect("/login"); }

  const children = await prisma.user.findMany({
    where: { familyId: parent.familyId, role: "CHILD" },
    include: {
      wallet: true,
      devices: true,
      internetSessions: { where: { status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" }, take: 1 },
      tasksAssigned: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { name: "asc" },
  });

  const claimed = await prisma.householdTask.findMany({
    where: { familyId: parent.familyId, status: "CLAIMED" },
    include: { child: true },
    orderBy: { claimedAt: "asc" },
  });

  return <main className="appShell">
    <header className="topbar">
      <div><span className="eyebrow">ESPACE PARENT</span><h1>Bonjour {parent.name}</h1></div>
      <LogoutButton />
    </header>

    <section className="heroCard">
      <div><span className="eyebrow">RewardConnection</span><h2>Gérez les récompenses et l'accès Internet.</h2><p>1 jeton = {process.env.TOKEN_MINUTES || 60} minutes de connexion.</p></div>
      <div className="heroIcon">🪙</div>
    </section>

    <section>
      <div className="sectionTitle"><h2>Enfants</h2><span>{children.length} compte{children.length > 1 ? "s" : ""}</span></div>
      <div className="cards">
        {children.map((child) => {
          const active = child.internetSessions[0];
          return <article className="card childCard" key={child.id}>
            <div className="avatar">{child.name.slice(0, 1).toUpperCase()}</div>
            <div className="grow"><h3>{child.name}</h3><div className="stats">
              <span>🪙 <strong>{child.wallet?.balance ?? 0}</strong> jeton(s)</span>
              <span className={active ? "online" : "offline"}>{active ? "● " + remaining(active.expiresAt) : "● Internet coupé"}</span>
              <span>{child.devices.length} appareil(s)</span>
            </div></div>
          </article>;
        })}
      </div>
    </section>

    <div className="grid2">
      <CreateChildForm />
      <div className="card">
        <h3>Principe</h3>
        <p className="muted">Ajoute les appareils de chaque enfant avec une réservation DHCP fixe. Lorsqu'un jeton est utilisé, RewardConnection autorise leurs IP pendant la durée configurée.</p>
      </div>
    </div>

    <ParentActions children={children.map(c => ({ id: c.id, name: c.name }))} />

    <section>
      <div className="sectionTitle"><h2>À valider</h2><span>{claimed.length}</span></div>
      <div className="stack">
        {claimed.length === 0 && <div className="card empty">Aucune mission en attente de validation.</div>}
        {claimed.map(task => <article className="card taskRow" key={task.id}>
          <div><strong>{task.title}</strong><p>{task.child.name} · récompense {task.reward} 🪙</p></div>
          <TaskResolveButtons id={task.id} />
        </article>)}
      </div>
    </section>

    <section>
      <div className="sectionTitle"><h2>Appareils</h2></div>
      <div className="stack">
        {children.flatMap(child => child.devices.map(device => <article className="card taskRow" key={device.id}>
          <div><strong>{device.name}</strong><p>{child.name} · {device.ipAddress || "IP non renseignée"} · {device.macAddress || "MAC non renseignée"}</p></div>
          <span className={device.enabled ? "badge success" : "badge"}>{device.enabled ? "Actif" : "Désactivé"}</span>
        </article>))}
      </div>
    </section>
  </main>;
}
