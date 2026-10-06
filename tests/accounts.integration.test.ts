import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { updateChildAccount } from "../src/lib/accounts";
import { createFamilyFixture, resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

test("a parent can update a child name, email and password inside the family", async () => {
  const { family, child } = await createFamilyFixture();

  const updated = await updateChildAccount({
    familyId: family.id,
    childId: child.id,
    name: "Adam",
    email: "adam@test.local",
    password: "nouveau-pass-123",
  });

  assert.equal(updated.name, "Adam");
  assert.equal(updated.email, "adam@test.local");

  const stored = await prisma.user.findUniqueOrThrow({ where: { id: child.id } });
  assert.equal(await bcrypt.compare("nouveau-pass-123", stored.passwordHash), true);
});

test("a parent cannot update a child from another family", async () => {
  const first = await createFamilyFixture();
  const secondFamily = await prisma.family.create({ data: { name: "Autre Famille" } });

  await assert.rejects(
    () => updateChildAccount({
      familyId: secondFamily.id,
      childId: first.child.id,
      name: "Intrus",
    }),
    /CHILD_NOT_FOUND/,
  );
});
