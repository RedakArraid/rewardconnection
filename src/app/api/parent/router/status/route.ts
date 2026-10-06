import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth";
import { getRouterStatus } from "@/lib/mikrotik";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    await requireParent();
    return NextResponse.json(await getRouterStatus());
  } catch (error) {
    return apiError(error);
  }
}
