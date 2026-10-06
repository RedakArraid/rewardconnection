import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resyncActiveSessions } from "@/lib/session";

function authorized(req: Request) {
  const expected = process.env.INTERNAL_CRON_SECRET || "";
  if (expected.length < 24) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const result = await resyncActiveSessions();
    const lastError = result.failures.length
      ? `${result.failures.length} session(s) non synchronisée(s)`
      : null;

    await prisma.serviceHeartbeat.upsert({
      where: { id: "network-worker" },
      create: {
        id: "network-worker",
        lastSeenAt: now,
        lastSuccessAt: result.failures.length ? null : now,
        lastError,
        metadata: result,
      },
      update: {
        lastSeenAt: now,
        ...(result.failures.length ? {} : { lastSuccessAt: now }),
        lastError,
        metadata: result,
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    try {
      await prisma.serviceHeartbeat.upsert({
        where: { id: "network-worker" },
        create: {
          id: "network-worker",
          lastSeenAt: now,
          lastError: message,
        },
        update: {
          lastSeenAt: now,
          lastError: message,
        },
      });
    } catch (heartbeatError) {
      console.error("Unable to store worker heartbeat", heartbeatError);
    }

    console.error("Internal reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
