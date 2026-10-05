import { prisma } from "@/lib/prisma";
import { authorizeDevices, revokeDevices } from "@/lib/mikrotik";

export async function activateInternet(childId: string) {
  const minutes = Number(process.env.TOKEN_MINUTES || 60);
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("Invalid TOKEN_MINUTES");

  return prisma.$transaction(async (tx) => {
    const child = await tx.user.findUnique({
      where: { id: childId },
      include: { wallet: true, devices: { where: { enabled: true } } },
    });
    if (!child || child.role !== "CHILD") throw new Error("Child not found");
    if (!child.wallet || child.wallet.balance < 1) throw new Error("NO_TOKENS");

    const active = await tx.internetSession.findFirst({
      where: { userId: childId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    });
    if (active) throw new Error("SESSION_ALREADY_ACTIVE");

    const expiresAt = new Date(Date.now() + minutes * 60_000);

    await tx.tokenWallet.update({
      where: { userId: childId },
      data: { balance: { decrement: 1 } },
    });

    await tx.tokenTransaction.create({
      data: {
        userId: childId,
        type: "SPEND",
        amount: -1,
        reason: `${minutes} minutes d'Internet`,
      },
    });

    const session = await tx.internetSession.create({
      data: { userId: childId, expiresAt, tokenCost: 1 },
    });

    try {
      const router = await authorizeDevices(child.devices, minutes, childId);
      return { session, router };
    } catch (error) {
      await tx.tokenWallet.update({ where: { userId: childId }, data: { balance: { increment: 1 } } });
      await tx.tokenTransaction.create({
        data: { userId: childId, type: "ADJUSTMENT", amount: 1, reason: "Remboursement suite erreur routeur" },
      });
      await tx.internetSession.update({ where: { id: session.id }, data: { status: "CANCELLED", endedAt: new Date() } });
      throw error;
    }
  });
}

export async function stopInternet(childId: string) {
  const devices = await prisma.device.findMany({ where: { userId: childId, enabled: true } });
  await revokeDevices(devices);
  await prisma.internetSession.updateMany({
    where: { userId: childId, status: "ACTIVE" },
    data: { status: "CANCELLED", endedAt: new Date() },
  });
}
