import { prisma } from "../src/lib/prisma";

export async function resetDatabase() {
  await prisma.activeInternetAccess.deleteMany();
  await prisma.internetSession.deleteMany();
  await prisma.tokenTransaction.deleteMany();
  await prisma.householdTask.deleteMany();
  await prisma.device.deleteMany();
  await prisma.tokenWallet.deleteMany();
  await prisma.user.deleteMany();
  await prisma.family.deleteMany();
}

export async function createFamilyFixture(options?: { balance?: number; withDevice?: boolean }) {
  const family = await prisma.family.create({ data: { name: "Famille Test" } });
  const parent = await prisma.user.create({
    data: {
      familyId: family.id,
      role: "PARENT",
      name: "Parent Test",
      email: `parent-${family.id}@test.local`,
      passwordHash: "not-used-in-service-tests",
    },
  });
  const child = await prisma.user.create({
    data: {
      familyId: family.id,
      role: "CHILD",
      name: "Enfant Test",
      email: `child-${family.id}@test.local`,
      passwordHash: "not-used-in-service-tests",
      wallet: { create: { balance: options?.balance ?? 2 } },
    },
  });

  const device = options?.withDevice === false
    ? null
    : await prisma.device.create({
        data: {
          familyId: family.id,
          userId: child.id,
          name: "Tablette Test",
          ipAddress: "192.168.20.21",
          macAddress: "AA:BB:CC:DD:EE:21",
        },
      });

  return { family, parent, child, device };
}
