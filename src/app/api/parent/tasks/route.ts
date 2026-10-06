import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";

const schema = z.object({
  childId: z.string().min(1),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  reward: z.number().int().min(0).max(20).default(1),
});

export async function POST(req: Request) {
  try {
    const parent = await requireParent();
    const data = schema.parse(await req.json());
    const child = await prisma.user.findFirst({
      where: { id: data.childId, familyId: parent.familyId, role: "CHILD" },
      select: { id: true },
    });
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const task = await prisma.householdTask.create({
      data: {
        familyId: parent.familyId,
        childId: child.id,
        createdById: parent.id,
        title: data.title,
        description: data.description || null,
        reward: data.reward,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    return apiError(error);
  }
}
