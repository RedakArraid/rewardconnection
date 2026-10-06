import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  try {
    const parent = await requireParent();
    const data = schema.parse(await req.json());
    const passwordHash = await bcrypt.hash(data.password, 12);

    const child = await prisma.user.create({
      data: {
        familyId: parent.familyId,
        role: "CHILD",
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        wallet: { create: { balance: 0 } },
      },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json(child);
  } catch (error) {
    return apiError(error);
  }
}
