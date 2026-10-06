import { prisma } from "@/lib/prisma";

export async function claimTask(childId: string, taskId: string) {
  const result = await prisma.householdTask.updateMany({
    where: {
      id: taskId,
      childId,
      status: { in: ["OPEN", "REJECTED"] },
    },
    data: {
      status: "CLAIMED",
      claimedAt: new Date(),
      resolvedAt: null,
    },
  });

  if (result.count !== 1) throw new Error("TASK_NOT_CLAIMABLE");
}

export async function resolveTask(input: {
  parentId: string;
  familyId: string;
  taskId: string;
  approved: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.householdTask.findFirst({
      where: { id: input.taskId, familyId: input.familyId },
    });
    if (!task) throw new Error("TASK_NOT_CLAIMED");

    const claimed = await tx.householdTask.updateMany({
      where: { id: task.id, status: "CLAIMED" },
      data: {
        status: input.approved ? "APPROVED" : "REJECTED",
        resolvedAt: new Date(),
      },
    });
    if (claimed.count !== 1) throw new Error("TASK_NOT_CLAIMED");

    if (input.approved && task.reward > 0) {
      await tx.tokenWallet.upsert({
        where: { userId: task.childId },
        create: { userId: task.childId, balance: task.reward },
        update: { balance: { increment: task.reward } },
      });
      await tx.tokenTransaction.create({
        data: {
          userId: task.childId,
          issuerId: input.parentId,
          type: "TASK_REWARD",
          amount: task.reward,
          reason: task.title,
        },
      });
    }

    return { taskId: task.id, approved: input.approved };
  });
}
