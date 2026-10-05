import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";

const schema = z.object({ childId: z.string().min(1), amount: z.number().int().min(-20).max(20), reason: z.string().max(200).optional() });

export async function POST(req: Request) {
  try {
    const parent = await requireParent();
    const data = schema.parse(await req.json());
    if (data.amount === 0) return NextResponse.json({ error: "Montant nul" }, { status: 400 });

    const child = await prisma.user.findFirst({ where: { id: data.childId, familyId: parent.familyId, role: "CHILD" } });
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.tokenWallet.upsert({
        where: { userId: child.id },
        create: { userId: child.id, balance: Math.max(0, data.amount) },
        update: { balance: { increment: data.amount } },
      });
      if (wallet.balance < 0) throw new Error("NEGATIVE_BALANCE");
      await tx.tokenTransaction.create({
        data: { userId: child.id, issuerId: parent.id, type: data.amount > 0 ? "GRANT" : "ADJUSTMENT", amount: data.amount, reason: data.reason || "Ajustement parent" },
      });
      return wallet;
    });

    return NextResponse.json({ balance: result.balance });
  } catch (error) {
    if (error instanceof Error && error.message === "NEGATIVE_BALANCE") {
      return NextResponse.json({ error: "Solde insuffisant" }, { status: 400 });
    }
    return apiError(error);
  }
}
