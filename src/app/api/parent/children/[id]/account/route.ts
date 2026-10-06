import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { updateChildAccount } from "@/lib/accounts";
import { apiError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(100).optional(),
}).refine(
  (value) => Boolean(value.name || value.email || value.password),
  "Aucune modification fournie",
);

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireParent();
    const { id } = await context.params;
    const data = schema.parse(await req.json());

    const child = await updateChildAccount({
      familyId: parent.familyId,
      childId: id,
      ...data,
    });

    return NextResponse.json(child);
  } catch (error) {
    return apiError(error);
  }
}
