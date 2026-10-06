import { NextResponse } from "next/server";
import { requireChild } from "@/lib/auth";
import { claimTask } from "@/lib/tasks";
import { apiError } from "@/lib/http";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const child = await requireChild();
    const { id } = await context.params;
    await claimTask(child.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
