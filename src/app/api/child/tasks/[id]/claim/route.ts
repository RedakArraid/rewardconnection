import { NextResponse } from "next/server";
import { requireChild } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const child = await requireChild();
    const { id } = await context.params;
    const task = await prisma.householdTask.findFirst({ where: { id, childId: child.id, status: { in: ["OPEN", "REJECTED"] } } });
    if (!task) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
    await prisma.householdTask.update({ where: { id }, data: { status: "CLAIMED", claimedAt: new Date(), resolvedAt: null } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
