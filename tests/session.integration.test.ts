import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { activateInternet, reconcileExpiredSessions, stopInternet } from "../src/lib/session";
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

test("activation spends one token and creates one active access", async () => {
  const { child } = await createFamilyFixture({ balance: 2 });

  const result = await activateInternet(child.id);
  assert.equal(result.router.mode, "simulation");

  const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });
  const active = await prisma.activeInternetAccess.findUnique({ where: { userId: child.id } });
  const spend = await prisma.tokenTransaction.findMany({ where: { userId: child.id, type: "SPEND" } });

  assert.equal(wallet.balance, 1);
  assert.ok(active);
  assert.equal(spend.length, 1);
  assert.equal(spend[0]?.amount, -1);
});

test("two concurrent activations cannot spend two tokens", async () => {
  const { child } = await createFamilyFixture({ balance: 2 });

  const results = await Promise.allSettled([
    activateInternet(child.id),
    activateInternet(child.id),
  ]);

  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);

  const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });
  const activeCount = await prisma.activeInternetAccess.count({ where: { userId: child.id } });
  const spendCount = await prisma.tokenTransaction.count({ where: { userId: child.id, type: "SPEND" } });
  const activeSessionCount = await prisma.internetSession.count({ where: { userId: child.id, status: "ACTIVE" } });

  assert.equal(wallet.balance, 1);
  assert.equal(activeCount, 1);
  assert.equal(spendCount, 1);
  assert.equal(activeSessionCount, 1);
});

test("parent stop cancels active access without refund", async () => {
  const { child } = await createFamilyFixture({ balance: 2 });
  await activateInternet(child.id);

  await stopInternet(child.id);

  const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });
  const active = await prisma.activeInternetAccess.findUnique({ where: { userId: child.id } });
  const session = await prisma.internetSession.findFirstOrThrow({ where: { userId: child.id } });

  assert.equal(wallet.balance, 1);
  assert.equal(active, null);
  assert.equal(session.status, "CANCELLED");
  assert.ok(session.endedAt);
});

test("expired sessions are reconciled in PostgreSQL", async () => {
  const { child } = await createFamilyFixture({ balance: 2 });
  await activateInternet(child.id);

  const past = new Date(Date.now() - 60_000);
  const access = await prisma.activeInternetAccess.findUniqueOrThrow({ where: { userId: child.id } });

  await prisma.$transaction([
    prisma.activeInternetAccess.update({ where: { userId: child.id }, data: { expiresAt: past } }),
    prisma.internetSession.update({ where: { id: access.sessionId }, data: { expiresAt: past } }),
  ]);

  const count = await reconcileExpiredSessions({ userId: child.id });
  const session = await prisma.internetSession.findUniqueOrThrow({ where: { id: access.sessionId } });
  const active = await prisma.activeInternetAccess.findUnique({ where: { userId: child.id } });

  assert.equal(count, 1);
  assert.equal(session.status, "EXPIRED");
  assert.ok(session.endedAt);
  assert.equal(active, null);
});

test("activation is rejected when the child has no configured device", async () => {
  const { child } = await createFamilyFixture({ balance: 2, withDevice: false });

  await assert.rejects(() => activateInternet(child.id), /NO_CONFIGURED_DEVICES/);

  const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });
  assert.equal(wallet.balance, 2);
});


test("family token duration controls the next Internet session", async () => {
  const { child } = await createFamilyFixture({ balance: 2, tokenMinutes: 25 });
  const before = Date.now();

  const result = await activateInternet(child.id);
  const durationMs = result.session.expiresAt.getTime() - before;
  const spend = await prisma.tokenTransaction.findFirstOrThrow({
    where: { userId: child.id, type: "SPEND" },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(durationMs >= 24 * 60_000);
  assert.ok(durationMs <= 26 * 60_000);
  assert.equal(spend.reason, "25 minutes d'Internet");
});
