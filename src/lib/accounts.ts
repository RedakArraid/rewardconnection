import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function updateChildAccount(input: {
  familyId: string;
  childId: string;
  name?: string;
  email?: string;
  password?: string;
}) {
  const child = await prisma.user.findFirst({
    where: {
      id: input.childId,
      familyId: input.familyId,
      role: "CHILD",
    },
    select: { id: true },
  });

  if (!child) throw new Error("CHILD_NOT_FOUND");

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, 12)
    : undefined;

  return prisma.user.update({
    where: { id: child.id },
    data: {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}
