import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { POST } from "../src/app/api/internal/reconcile/route";
import { activateInternet } from "../src/lib/session";
import { createFamilyFixture, resetDatabase } from "./helpers";

const secret = "test-internal-secret-with-more-than-twenty-four-characters";

process.env.INTERNAL_CRON_SECRET = secret;
process.env.MIKROTIK_ENABLED = "false";
process.env.MIKROTIK_CHILD_SUBNET = "192.168.20.0/24";
process.env.TOKEN_MINUTES = "60";

beforeEach(async () => {
  await resetDatabase();
  await prisma.serviceHeartbeat.deleteMany();
});

after(async () => {
  await resetDatabase();
  await prisma.serviceHeartbeat.deleteMany();
  await prisma.$disconnect();
});

test("internal reconcile endpoint rejects missing credentials", async () => {
  const response = await POST(new Request("http://localhost/api/internal/reconcile", { method: "POST" }));
  assert.equal(response.status, 401);
});

test("worker reconciliation writes a healthy heartbeat without spending another token", async () => {
  const { child } = await createFamilyFixture({ balance: 2 });
  await activateInternet(child.id);

  const before = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });

  const response = await POST(new Request("http://localhost/api/internal/reconcile", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  }));

  assert.equal(response.status, 200);

  const heartbeat = await prisma.serviceHeartbeat.findUniqueOrThrow({ where: { id: "network-worker" } });
  const afterWallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { userId: child.id } });

  assert.ok(heartbeat.lastSeenAt);
  assert.ok(heartbeat.lastSuccessAt);
  assert.equal(heartbeat.lastError, null);
  assert.equal(before.balance, 1);
  assert.equal(afterWallet.balance, 1);
});
