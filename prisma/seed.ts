import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const family = await prisma.family.upsert({
    where: { id: "demo-family" },
    update: {},
    create: { id: "demo-family", name: "Famille Démo" },
  });

  const passwordHash = await bcrypt.hash("demo1234", 12);

  const parent = await prisma.user.upsert({
    where: { email: "parent@demo.local" },
    update: {},
    create: {
      familyId: family.id,
      role: UserRole.PARENT,
      name: "Parent Démo",
      email: "parent@demo.local",
      passwordHash,
    },
  });

  const child = await prisma.user.upsert({
    where: { email: "enfant@demo.local" },
    update: {},
    create: {
      familyId: family.id,
      role: UserRole.CHILD,
      name: "Adam",
      email: "enfant@demo.local",
      passwordHash,
      wallet: { create: { balance: 3 } },
    },
  });

  await prisma.tokenWallet.upsert({
    where: { userId: child.id },
    update: {},
    create: { userId: child.id, balance: 3 },
  });

  const existing = await prisma.householdTask.count({ where: { childId: child.id } });
  if (!existing) {
    await prisma.householdTask.createMany({
      data: [
        { familyId: family.id, childId: child.id, createdById: parent.id, title: "Ranger sa chambre", reward: 1 },
        { familyId: family.id, childId: child.id, createdById: parent.id, title: "Mettre la table", reward: 1 },
      ],
    });
  }

  console.log("Demo parent: parent@demo.local / demo1234");
  console.log("Demo child: enfant@demo.local / demo1234");
}

main().finally(() => prisma.$disconnect());
