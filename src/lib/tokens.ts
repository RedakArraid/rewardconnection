import { prisma } from "@/lib/prisma";

export async function adjustTokens(input: {
  childId: string;
  issuerId: string;
  amount: number;
  reason: string;
}) {
  if (input.amount === 0) throw new Error("NEGATIVE_BALANCE");

  return prisma.$transaction(async (tx) => {
    await tx.tokenWallet.upsert({
      where: { userId: input.childId },
      create: { userId: input.childId, balance: 0 },
      update: {},
    });

    if (input.amount < 0) {
      const updated = await tx.tokenWallet.updateMany({
        where: { userId: input.childId, balance: { gte: Math.abs(input.amount) } },
        data: { balance: { increment: input.amount } },
      });
      if (updated.count !== 1) throw new Error("NEGATIVE_BALANCE");
    } else {
      await tx.tokenWallet.update({
        where: { userId: input.childId },
        data: { balance: { increment: input.amount } },
      });
    }

    await tx.tokenTransaction.create({
      data: {
        userId: input.childId,
        issuerId: input.issuerId,
        type: input.amount > 0 ? "GRANT" : "ADJUSTMENT",
        amount: input.amount,
        reason: input.reason,
      },
    });

    return tx.tokenWallet.findUniqueOrThrow({ where: { userId: input.childId } });
  });
}
