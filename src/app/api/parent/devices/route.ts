import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";
import { assertChildSubnet, normalizeIPv4, normalizeMac } from "@/lib/network";

const schema = z.object({
  childId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  macAddress: z.string().trim().min(1).max(30),
  ipAddress: z.string().trim().min(1).max(45),
});

export async function POST(req: Request) {
  try {
    const parent = await requireParent();
    const data = schema.parse(await req.json());
    const ipAddress = normalizeIPv4(data.ipAddress);
    const macAddress = normalizeMac(data.macAddress);
    assertChildSubnet(ipAddress);

    const child = await prisma.user.findFirst({
      where: { id: data.childId, familyId: parent.familyId, role: "CHILD" },
      select: { id: true },
    });
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const duplicate = await prisma.device.findFirst({
      where: {
        familyId: parent.familyId,
        OR: [{ ipAddress }, { macAddress }],
      },
      select: { id: true },
    });
    if (duplicate) throw new Error("DUPLICATE_DEVICE");

    const device = await prisma.device.create({
      data: {
        familyId: parent.familyId,
        userId: child.id,
        name: data.name,
        macAddress,
        ipAddress,
      },
    });

    return NextResponse.json(device);
  } catch (error) {
    return apiError(error);
  }
}
