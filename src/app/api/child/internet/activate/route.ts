import { NextResponse } from "next/server";
import { requireChild } from "@/lib/auth";
import { activateInternet } from "@/lib/session";
import { apiError } from "@/lib/http";

export async function POST() {
  try {
    const child = await requireChild();
    const result = await activateInternet(child.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "NO_TOKENS") return NextResponse.json({ error: "Aucun jeton disponible" }, { status: 400 });
    if (e instanceof Error && e.message === "SESSION_ALREADY_ACTIVE") return NextResponse.json({ error: "Une session est déjà active" }, { status: 400 });
    return apiError(e);
  }
}
