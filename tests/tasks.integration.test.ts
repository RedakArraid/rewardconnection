import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { claimTask, resolveTask } from "../src/lib/tasks";
import { createFamilyFixture, resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

test("a child can claim an open task once", async () => {
  const { family, parent, child } = await createFamilyFixture({ balance: 0 });
  const task = await prisma.householdTask.create({
    data: {
      familyId: family.id,
      childId: child.id,
      createdById: parent.id,
      title: "Mettre la table",
      reward: 1,
    },
  });

  await claimTask(child.id, task.id);
  await assert.rejects(() => claimTask(child.id, task.id), /TASK_NOT_CLAIMABLE/);

  const stored = await prisma.householdTask.findUniqueOrThrow({ where: { id: task.id } });
  assert.equal(stored.status, "CLAIMED");
  assert.ok(stored.claimedAt);
});

test("concurrent parent approvals reward a claimed task only once", async () => {
  const { family, parent, child } = await createFamilyFixture({ balance: 0 });
  const task = await prisma.householdTask.create({
    data: {
      familyId: family.id,
      childId: child.id,
      createdById: parent.id,
      title: "Ranger sa chambre",
      reward: 2,
      status: "CLAIMED",
      claimedAt: new Date(),
    },
  });

  const input = {
    parentId: parent.id,
    familyId: family.id,
    taskId: task.id,
    approved: true,
  };

  const results = await Promise.allSettled([resolveTask(input), resolveTask(input)]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);

  const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });
  const rewards = await prisma.tokenTransaction.count({
    where: { userId: child.id, type: "TASK_REWARD" },
  });
  const stored = await prisma.householdTask.findUniqueOrThrow({ where: { id: task.id } });

  assert.equal(wallet.balance, 2);
  assert.equal(rewards, 1);
  assert.equal(stored.status, "APPROVED");
});
