import { NextResponse } from "next/server";
import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { resolveTask } from "@/lib/tasks";
import { apiError } from "@/lib/http";

const schema = z.object({ approved: z.boolean() });

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireParent();
    const { id } = await context.params;
    const { approved } = schema.parse(await req.json());

    await resolveTask({
      parentId: parent.id,
      familyId: parent.familyId,
      taskId: id,
      approved,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
