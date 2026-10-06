import { redirect } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconcileExpiredSessions } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import ParentActions from "@/components/ParentActions";
import TaskResolveButtons from "@/components/TaskResolveButtons";
import CreateChildForm from "@/components/CreateChildForm";
import CreateParentForm from "@/components/CreateParentForm";
import RouterPanel from "@/components/RouterPanel";
import DeviceActions from "@/components/DeviceActions";
import SystemStatus from "@/components/SystemStatus";
import ChildAccountManager from "@/components/ChildAccountManager";

function remaining(expiresAt: Date) {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return "Inactif";
  return `${Math.ceil(ms / 60000)} min restantes`;
}

export default async function ParentPage() {
  let parent;
  try {
    parent = await requireParent();
  } catch {
    redirect("/login");
  }

  await reconcileExpiredSessions({ familyId: parent.familyId });

  const [children, claimed, parents] = await Promise.all([
    prisma.user.findMany({
      where: { familyId: parent.familyId, role: "CHILD" },
      include: {
        wallet: true,
        devices: true,
        activeInternetAccess: { include: { session: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.householdTask.findMany({
      where: { familyId: parent.familyId, status: "CLAIMED" },
      include: { child: true },
      orderBy: { claimedAt: "asc" },
    }),
    prisma.user.findMany({
      where: { familyId: parent.familyId, role: "PARENT" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const childOptions = children.map((child) => ({ id: child.id, name: child.name }));
  const childAccounts = children.map((child) => ({ id: child.id, name: child.name, email: child.email }));

  return (
    <main className="appShell">
      <header className="topbar">
        <div><span className="eyebrow">ESPACE PARENT</span><h1>Bonjour {parent.name}</h1></div>
        <LogoutButton />
      </header>

      <section className="heroCard">
        <div>
          <span className="eyebrow">RewardConnection</span>
          <h2>Les efforts deviennent du temps Internet.</h2>
          <p>1 jeton = {process.env.TOKEN_MINUTES || 60} minutes de connexion pour tous les appareils de l'enfant.</p>
        </div>
        <div className="heroIcon">🪙</div>
      </section>

      <section>
        <div className="sectionTitle"><h2>Enfants</h2><span>{children.length} compte{children.length > 1 ? "s" : ""}</span></div>
        <div className="cards">
          {children.map((child) => {
            const active = child.activeInternetAccess?.session;
            return (
              <article className="card childCard" key={child.id}>
                <div className="avatar">{child.name.slice(0, 1).toUpperCase()}</div>
                <div className="grow">
                  <h3>{child.name}</h3>
                  <div className="stats">
                    <span>🪙 <strong>{child.wallet?.balance ?? 0}</strong> jeton(s)</span>
                    <span className={active ? "online" : "offline"}>
                      {active ? "● " + remaining(active.expiresAt) : "● Internet coupé"}
                    </span>
                    <span>{child.devices.length} appareil(s)</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <SystemStatus />

      <RouterPanel children={childOptions} />

      <div className="grid2">
        <CreateChildForm />
        <CreateParentForm />
      </div>

      <ChildAccountManager children={childAccounts} />

      <section className="card compact">
        <strong>Parents autorisés</strong>
        <div className="stats parentList">
          {parents.map((member) => <span key={member.id}>{member.name} · {member.email}</span>)}
        </div>
      </section>

      <ParentActions children={childOptions} />

      <section>
        <div className="sectionTitle"><h2>À valider</h2><span>{claimed.length}</span></div>
        <div className="stack">
          {claimed.length === 0 && <div className="card empty">Aucune mission en attente de validation.</div>}
          {claimed.map((task) => (
            <article className="card taskRow" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p>{task.child.name} · récompense {task.reward} 🪙</p>
              </div>
              <TaskResolveButtons id={task.id} />
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="sectionTitle"><h2>Appareils associés</h2></div>
        <div className="stack">
          {children.flatMap((child) => child.devices.map((device) => (
            <article className="card taskRow" key={device.id}>
              <div>
                <strong>{device.name}</strong>
                <p>{child.name} · {device.ipAddress || "IP absente"} · {device.macAddress || "MAC absente"}</p>
              </div>
              <DeviceActions id={device.id} enabled={device.enabled} />
            </article>
          )))}
          {children.every((child) => child.devices.length === 0) && <div className="card empty">Aucun appareil associé.</div>}
        </div>
      </section>
    </main>
  );
}
