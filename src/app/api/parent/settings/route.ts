import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/http";

const schema = z.object({
  familyName: z.string().trim().min(2).max(80),
  tokenMinutes: z.number().int().min(5).max(1440),
});

export async function GET() {
  try {
    const parent = await requireParent();
    const family = await prisma.family.findUniqueOrThrow({
      where: { id: parent.familyId },
      select: { name: true, tokenMinutes: true },
    });
    return NextResponse.json(family);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const parent = await requireParent();
    const data = schema.parse(await req.json());
    const family = await prisma.family.update({
      where: { id: parent.familyId },
      data: {
        name: data.familyName,
        tokenMinutes: data.tokenMinutes,
      },
      select: { name: true, tokenMinutes: true },
    });
    return NextResponse.json(family);
  } catch (error) {
    return apiError(error);
  }
}
