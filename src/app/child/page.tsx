import { redirect } from "next/navigation";
import { requireChild } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconcileExpiredSessions } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import ChildActions from "@/components/ChildActions";
import ClaimTaskButton from "@/components/ClaimTaskButton";
import InternetTimer from "@/components/InternetTimer";

export default async function ChildPage() {
  let child;
  try {
    child = await requireChild();
  } catch {
    redirect("/login");
  }

  await reconcileExpiredSessions({ userId: child.id });

  const [wallet, active, tasks, transactions, devices, family] = await Promise.all([
    prisma.tokenWallet.findUnique({ where: { userId: child.id } }),
    prisma.activeInternetAccess.findUnique({
      where: { userId: child.id },
      include: { session: true },
    }),
    prisma.householdTask.findMany({
      where: { childId: child.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.tokenTransaction.findMany({
      where: { userId: child.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.device.findMany({
      where: { userId: child.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.family.findUniqueOrThrow({
      where: { id: child.familyId },
      select: { tokenMinutes: true },
    }),
  ]);

  const expiresAt = active?.session.expiresAt || null;
  const initialSeconds = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
    : 0;
  const canActivate = devices.some((device) => device.enabled && Boolean(device.ipAddress));

  return (
    <main className="appShell childTheme">
      <header className="topbar">
        <div><span className="eyebrow">ESPACE ENFANT</span><h1>Salut {child.name} 👋</h1></div>
        <LogoutButton />
      </header>

      <section className="internetCard">
        <span className="eyebrow">MON TEMPS INTERNET</span>
        <div className="tokenCount">🪙 {wallet?.balance ?? 0}</div>
        <InternetTimer
          expiresAt={expiresAt?.toISOString() || null}
          initialSeconds={initialSeconds}
        />
        <p>{active ? "Internet est actif sur tes appareils" : `Utilise 1 jeton pour ${family.tokenMinutes} minutes`}</p>
        <ChildActions active={Boolean(active)} canActivate={canActivate} />
      </section>

      <section>
        <div className="sectionTitle"><h2>Mes missions</h2></div>
        <div className="stack">
          {tasks.filter((task) => task.status !== "APPROVED").map((task) => (
            <article className="card taskRow" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p>{task.description || "Mission de la maison"} · +{task.reward} 🪙</p>
                <span className="badge">
                  {task.status === "CLAIMED"
                    ? "En attente du parent"
                    : task.status === "REJECTED"
                      ? "À refaire"
                      : "À faire"}
                </span>
              </div>
              {(task.status === "OPEN" || task.status === "REJECTED") && <ClaimTaskButton id={task.id} />}
            </article>
          ))}
          {tasks.filter((task) => task.status !== "APPROVED").length === 0 && (
            <div className="card empty">Toutes tes missions sont terminées 🎉</div>
          )}
        </div>
      </section>

      <section className="grid2">
        <div>
          <div className="sectionTitle"><h2>Mes appareils</h2></div>
          <div className="stack">
            {devices.map((device) => (
              <div className="card taskRow" key={device.id}>
                <div><strong>{device.name}</strong><p>{device.ipAddress || "En attente de configuration"}</p></div>
                <span className={device.enabled ? "badge success" : "badge"}>{device.enabled ? "Associé" : "Désactivé"}</span>
              </div>
            ))}
            {!devices.length && <div className="card empty">Demande à un parent d'associer ton appareil.</div>}
          </div>
        </div>

        <div>
          <div className="sectionTitle"><h2>Mes jetons</h2></div>
          <div className="stack">
            {transactions.map((transaction) => (
              <div className="card taskRow" key={transaction.id}>
                <div>
                  <strong>{transaction.reason || transaction.type}</strong>
                  <p>{transaction.createdAt.toLocaleDateString("fr-FR")}</p>
                </div>
                <strong className={transaction.amount > 0 ? "online" : ""}>
                  {transaction.amount > 0 ? "+" : ""}{transaction.amount} 🪙
                </strong>
              </div>
            ))}
            {!transactions.length && <div className="card empty">Aucun mouvement de jeton.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
