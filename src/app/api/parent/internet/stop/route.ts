import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stopInternet } from "@/lib/session";
import { apiError } from "@/lib/http";

const schema = z.object({ childId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const parent = await requireParent();
    const { childId } = schema.parse(await req.json());
    const child = await prisma.user.findFirst({ where: { id: childId, familyId: parent.familyId, role: "CHILD" } });
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });
    await stopInternet(childId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
