import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { resyncActiveSessions } from "@/lib/session";

export async function POST() {
  try {
    const parent = await requireParent();
    const result = await resyncActiveSessions({ familyId: parent.familyId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
