import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { activateInternet, ensureChildInternetAccess, resyncActiveSessions } from "../src/lib/session";
import { createFamilyFixture, resetDatabase } from "./helpers";

process.env.MIKROTIK_ENABLED = "false";
process.env.MIKROTIK_CHILD_SUBNET = "192.168.20.0/24";
process.env.TOKEN_MINUTES = "60";

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

test("active sessions can be reconciled repeatedly without spending another token", async () => {
  const { child } = await createFamilyFixture({ balance: 2 });
  await activateInternet(child.id);

  const first = await resyncActiveSessions();
  const second = await resyncActiveSessions();

  const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });
  const spends = await prisma.tokenTransaction.count({ where: { userId: child.id, type: "SPEND" } });

  assert.equal(first.active, 1);
  assert.equal(first.synced, 1);
  assert.equal(second.active, 1);
  assert.equal(second.synced, 1);
  assert.equal(wallet.balance, 1);
  assert.equal(spends, 1);
});

test("a device added during an active session is included in the next synchronization", async () => {
  const { family, child } = await createFamilyFixture({ balance: 2 });
  await activateInternet(child.id);

  await prisma.device.create({
    data: {
      familyId: family.id,
      userId: child.id,
      name: "Console Test",
      ipAddress: "192.168.20.22",
      macAddress: "AA:BB:CC:DD:EE:22",
    },
  });

  const result = await ensureChildInternetAccess(child.id);
  assert.equal(result.active, true);

  const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });
  assert.equal(wallet.balance, 1);
});
