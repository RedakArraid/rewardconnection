import { NextResponse } from "next/server";

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}
