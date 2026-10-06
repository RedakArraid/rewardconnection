import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";
import { listDhcpLeases, makeDhcpLeaseStatic } from "@/lib/mikrotik";
import { assertChildSubnet, isIPv4InCidr, normalizeIPv4, normalizeMac } from "@/lib/network";

const assignSchema = z.object({
  childId: z.string().min(1),
  leaseId: z.string().min(1).max(50),
  name: z.string().trim().max(80).optional(),
});

export async function GET() {
  try {
    const parent = await requireParent();
    const [leases, devices] = await Promise.all([
      listDhcpLeases(),
      prisma.device.findMany({
        where: { familyId: parent.familyId },
        select: { id: true, userId: true, macAddress: true, ipAddress: true, name: true },
      }),
    ]);

    const childSubnet = process.env.MIKROTIK_CHILD_SUBNET || "";
    const filtered = childSubnet
      ? leases.filter((lease) => isIPv4InCidr(lease.address, childSubnet))
      : leases;

    return NextResponse.json({
      leases: filtered.map((lease) => {
        const assigned = devices.find(
          (device) => device.macAddress?.toUpperCase() === lease.macAddress.toUpperCase(),
        );
        return {
          ...lease,
          assigned: assigned
            ? { deviceId: assigned.id, userId: assigned.userId, name: assigned.name }
            : null,
        };
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const parent = await requireParent();
    const input = assignSchema.parse(await req.json());

    const child = await prisma.user.findFirst({
      where: { id: input.childId, familyId: parent.familyId, role: "CHILD" },
      select: { id: true },
    });
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const leases = await listDhcpLeases();
    const lease = leases.find((item) => item.id === input.leaseId);
    if (!lease) throw new Error("LEASE_NOT_FOUND");

    const ipAddress = normalizeIPv4(lease.address);
    const macAddress = normalizeMac(lease.macAddress);
    assertChildSubnet(ipAddress);

    const byIp = await prisma.device.findFirst({
      where: { familyId: parent.familyId, ipAddress },
      select: { id: true, macAddress: true },
    });
    if (byIp && byIp.macAddress?.toUpperCase() !== macAddress) throw new Error("DUPLICATE_DEVICE");

    if (lease.dynamic) await makeDhcpLeaseStatic(lease.id);

    const existing = await prisma.device.findFirst({
      where: { familyId: parent.familyId, macAddress },
      select: { id: true },
    });

    const device = existing
      ? await prisma.device.update({
          where: { id: existing.id },
          data: {
            userId: child.id,
            name: input.name || lease.hostName || macAddress,
            ipAddress,
            routerLeaseId: lease.id,
            hostname: lease.hostName,
            lastSeenAt: new Date(),
            enabled: true,
          },
        })
      : await prisma.device.create({
          data: {
            familyId: parent.familyId,
            userId: child.id,
            name: input.name || lease.hostName || macAddress,
            macAddress,
            ipAddress,
            routerLeaseId: lease.id,
            hostname: lease.hostName,
            lastSeenAt: new Date(),
          },
        });

    return NextResponse.json(device);
  } catch (error) {
    return apiError(error);
  }
}
