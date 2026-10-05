import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";

const schema = z.object({
  childId: z.string().min(1),
  name: z.string().min(1).max(80),
  macAddress: z.string().max(30).optional().nullable(),
  ipAddress: z.string().max(45).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const parent = await requireParent();
    const data = schema.parse(await req.json());
    const child = await prisma.user.findFirst({ where: { id: data.childId, familyId: parent.familyId, role: "CHILD" } });
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });
    const device = await prisma.device.create({
      data: { familyId: parent.familyId, userId: child.id, name: data.name, macAddress: data.macAddress || null, ipAddress: data.ipAddress || null },
    });
    return NextResponse.json(device);
  } catch (e) {
    return apiError(e);
  }
}
