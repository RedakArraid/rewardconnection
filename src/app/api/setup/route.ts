import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/http";

const schema = z.object({
  familyName: z.string().trim().min(2).max(80),
  parentName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  try {
    if (await prisma.user.count()) {
      return NextResponse.json({ error: "Installation déjà initialisée" }, { status: 409 });
    }

    const data = schema.parse(await req.json());
    const passwordHash = await bcrypt.hash(data.password, 12);

    const parent = await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({ data: { name: data.familyName } });
      return tx.user.create({
        data: {
          familyId: family.id,
          role: "PARENT",
          name: data.parentName,
          email: data.email.toLowerCase(),
          passwordHash,
        },
      });
    });

    await createSession(parent.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
