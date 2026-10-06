import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeDevices, revokeDevices } from "@/lib/mikrotik";
import { assertChildSubnet } from "@/lib/network";

function tokenMinutes() {
  const minutes = Number(process.env.TOKEN_MINUTES || 60);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error("Invalid TOKEN_MINUTES");
  }
  return Math.floor(minutes);
}

export async function reconcileExpiredSessions(options?: { userId?: string; familyId?: string }) {
  const now = new Date();
  const expired = await prisma.activeInternetAccess.findMany({
    where: {
      expiresAt: { lte: now },
      ...(options?.userId ? { userId: options.userId } : {}),
      ...(options?.familyId ? { user: { familyId: options.familyId } } : {}),
    },
    select: { userId: true, sessionId: true },
  });

  if (!expired.length) return 0;
  const sessionIds = expired.map((item) => item.sessionId);

  await prisma.$transaction([
    prisma.internetSession.updateMany({
      where: { id: { in: sessionIds }, status: "ACTIVE" },
      data: { status: "EXPIRED", endedAt: now },
    }),
    prisma.activeInternetAccess.deleteMany({
      where: { sessionId: { in: sessionIds } },
    }),
  ]);

  return expired.length;
}

export async function getActiveInternetAccess(userId: string) {
  await reconcileExpiredSessions({ userId });
  return prisma.activeInternetAccess.findUnique({
    where: { userId },
    include: { session: true },
  });
}

async function createSessionAtomically(childId: string, expiresAt: Date) {
  try {
    return await prisma.$transaction(async (tx) => {
      const child = await tx.user.findUnique({
        where: { id: childId },
        select: { id: true, role: true },
      });
      if (!child || child.role !== "CHILD") throw new Error("FORBIDDEN");

      const existing = await tx.activeInternetAccess.findUnique({ where: { userId: childId } });
      if (existing) throw new Error("SESSION_ALREADY_ACTIVE");

      const spent = await tx.tokenWallet.updateMany({
        where: { userId: childId, balance: { gte: 1 } },
        data: { balance: { decrement: 1 } },
      });
      if (spent.count !== 1) throw new Error("NO_TOKENS");

      const session = await tx.internetSession.create({
        data: { userId: childId, expiresAt, tokenCost: 1 },
      });

      await tx.activeInternetAccess.create({
        data: { userId: childId, sessionId: session.id, expiresAt },
      });

      await tx.tokenTransaction.create({
        data: {
          userId: childId,
          type: "SPEND",
          amount: -1,
          reason: `${tokenMinutes()} minutes d'Internet`,
        },
      });

      return session;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("SESSION_ALREADY_ACTIVE");
    }
    throw error;
  }
}

async function compensateFailedActivation(childId: string, sessionId: string) {
  await prisma.$transaction(async (tx) => {
    const session = await tx.internetSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "ACTIVE") return;

    await tx.activeInternetAccess.deleteMany({
      where: { userId: childId, sessionId },
    });
    await tx.internetSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED", endedAt: new Date() },
    });
    await tx.tokenWallet.update({
      where: { userId: childId },
      data: { balance: { increment: 1 } },
    });
    await tx.tokenTransaction.create({
      data: {
        userId: childId,
        type: "ADJUSTMENT",
        amount: 1,
        reason: "Remboursement automatique : activation réseau impossible",
      },
    });
  });
}

export async function activateInternet(childId: string) {
  await reconcileExpiredSessions({ userId: childId });

  const child = await prisma.user.findUnique({
    where: { id: childId },
    include: { devices: { where: { enabled: true } } },
  });
  if (!child || child.role !== "CHILD") throw new Error("FORBIDDEN");

  const devices = child.devices.filter((device) => Boolean(device.ipAddress));
  if (!devices.length) throw new Error("NO_CONFIGURED_DEVICES");
  for (const device of devices) {
    if (device.ipAddress) assertChildSubnet(device.ipAddress);
  }

  const expiresAt = new Date(Date.now() + tokenMinutes() * 60_000);
  const session = await createSessionAtomically(childId, expiresAt);

  try {
    const router = await authorizeDevices(devices, expiresAt, childId, session.id);
    await prisma.internetSession.update({
      where: { id: session.id },
      data: { routerRef: JSON.stringify(router) },
    });
    return { session, router };
  } catch (error) {
    try {
      await revokeDevices(devices);
    } catch (cleanupError) {
      console.error("MikroTik cleanup after activation failure also failed", cleanupError);
    }
    await compensateFailedActivation(childId, session.id);
    throw error;
  }
}

export async function stopInternet(childId: string) {
  await reconcileExpiredSessions({ userId: childId });
  const devices = await prisma.device.findMany({ where: { userId: childId, enabled: true } });

  await revokeDevices(devices);

  await prisma.$transaction(async (tx) => {
    const active = await tx.activeInternetAccess.findUnique({ where: { userId: childId } });
    if (active) {
      await tx.internetSession.updateMany({
        where: { id: active.sessionId, status: "ACTIVE" },
        data: { status: "CANCELLED", endedAt: new Date() },
      });
      await tx.activeInternetAccess.delete({ where: { userId: childId } });
    } else {
      await tx.internetSession.updateMany({
        where: { userId: childId, status: "ACTIVE", expiresAt: { gt: new Date() } },
        data: { status: "CANCELLED", endedAt: new Date() },
      });
    }
  });
}
