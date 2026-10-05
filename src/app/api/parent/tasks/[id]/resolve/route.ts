import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";

const schema = z.object({ approved: z.boolean() });

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireParent();
    const { id } = await context.params;
    const { approved } = schema.parse(await req.json());

    const task = await prisma.householdTask.findFirst({ where: { id, familyId: parent.familyId }, include: { child: true } });
    if (!task || task.status !== "CLAIMED") return NextResponse.json({ error: "Tâche non validable" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.householdTask.update({
        where: { id: task.id },
        data: { status: approved ? "APPROVED" : "REJECTED", resolvedAt: new Date() },
      });
      if (approved && task.reward > 0) {
        await tx.tokenWallet.upsert({
          where: { userId: task.childId },
          create: { userId: task.childId, balance: task.reward },
          update: { balance: { increment: task.reward } },
        });
        await tx.tokenTransaction.create({
          data: { userId: task.childId, issuerId: parent.id, type: "TASK_REWARD", amount: task.reward, reason: task.title },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
