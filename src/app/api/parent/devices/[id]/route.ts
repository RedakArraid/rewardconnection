import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";
import { authorizeDevices, revokeDevices } from "@/lib/mikrotik";
import { reconcileExpiredSessions } from "@/lib/session";

const patchSchema = z.object({ enabled: z.boolean() });

async function findDevice(parentFamilyId: string, id: string) {
  return prisma.device.findFirst({
    where: { id, familyId: parentFamilyId },
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireParent();
    const { id } = await context.params;
    const { enabled } = patchSchema.parse(await req.json());

    const device = await findDevice(parent.familyId, id);
    if (!device) return NextResponse.json({ error: "Appareil introuvable" }, { status: 404 });

    await reconcileExpiredSessions({ userId: device.userId });
    const active = await prisma.activeInternetAccess.findUnique({
      where: { userId: device.userId },
      include: { session: true },
    });

    if (!enabled && device.enabled) {
      await revokeDevices([device]);
    }

    if (enabled && !device.enabled && active) {
      await authorizeDevices(
        [{ ipAddress: device.ipAddress, macAddress: device.macAddress, name: device.name }],
        active.session.expiresAt,
        device.userId,
        active.sessionId,
      );
    }

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { enabled },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireParent();
    const { id } = await context.params;

    const device = await findDevice(parent.familyId, id);
    if (!device) return NextResponse.json({ error: "Appareil introuvable" }, { status: 404 });

    if (device.enabled) {
      await reconcileExpiredSessions({ userId: device.userId });
      const active = await prisma.activeInternetAccess.findUnique({ where: { userId: device.userId } });
      if (active) await revokeDevices([device]);
    }

    await prisma.device.delete({ where: { id: device.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
