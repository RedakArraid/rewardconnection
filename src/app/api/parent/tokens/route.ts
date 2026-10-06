import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustTokens } from "@/lib/tokens";
import { apiError } from "@/lib/http";

const schema = z.object({
  childId: z.string().min(1),
  amount: z.number().int().min(-20).max(20).refine((value) => value !== 0, "Le montant doit être différent de zéro"),
  reason: z.string().trim().min(1).max(200).default("Ajustement parent"),
});

export async function POST(req: Request) {
  try {
    const parent = await requireParent();
    const data = schema.parse(await req.json());

    const child = await prisma.user.findFirst({
      where: { id: data.childId, familyId: parent.familyId, role: "CHILD" },
      select: { id: true },
    });
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const wallet = await adjustTokens({
      childId: child.id,
      issuerId: parent.id,
      amount: data.amount,
      reason: data.reason,
    });

    return NextResponse.json({ balance: wallet.balance });
  } catch (error) {
    return apiError(error);
  }
}
