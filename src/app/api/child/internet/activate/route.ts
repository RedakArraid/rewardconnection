import { NextResponse } from "next/server";
import { requireChild } from "@/lib/auth";
import { activateInternet } from "@/lib/session";
import { apiError } from "@/lib/http";

export async function POST() {
  try {
    const child = await requireChild();
    const result = await activateInternet(child.id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
