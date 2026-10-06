import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRouterStatus, isMikrotikEnabled } from "@/lib/mikrotik";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const parent = await requireParent();

    const [heartbeat, children, devices, activeSessions] = await Promise.all([
      prisma.serviceHeartbeat.findUnique({ where: { id: "network-worker" } }),
      prisma.user.count({ where: { familyId: parent.familyId, role: "CHILD" } }),
      prisma.device.count({ where: { familyId: parent.familyId } }),
      prisma.activeInternetAccess.count({ where: { user: { familyId: parent.familyId } } }),
    ]);

    const heartbeatAgeMs = heartbeat ? Date.now() - heartbeat.lastSeenAt.getTime() : null;
    const workerHealthy = heartbeatAgeMs !== null && heartbeatAgeMs < 90_000;

    let router:
      | Awaited<ReturnType<typeof getRouterStatus>>
      | { mode: "mikrotik"; connected: false; message: string };

    try {
      router = await getRouterStatus();
    } catch (error) {
      router = {
        mode: "mikrotik",
        connected: false,
        message: error instanceof Error ? error.message : "ROUTER_ERROR",
      };
    }

    return NextResponse.json({
      database: { connected: true },
      worker: {
        healthy: workerHealthy,
        lastSeenAt: heartbeat?.lastSeenAt.toISOString() || null,
        lastSuccessAt: heartbeat?.lastSuccessAt?.toISOString() || null,
        lastError: heartbeat?.lastError || null,
      },
      router,
      configuration: {
        mikrotikEnabled: isMikrotikEnabled(),
        childSubnet: process.env.MIKROTIK_CHILD_SUBNET || null,
        tokenMinutes: Number(process.env.TOKEN_MINUTES || 60),
      },
      counts: { children, devices, activeSessions },
    });
  } catch (error) {
    return apiError(error);
  }
}
