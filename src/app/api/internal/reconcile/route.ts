import { NextResponse } from "next/server";
import { resyncActiveSessions } from "@/lib/session";

function authorized(req: Request) {
  const expected = process.env.INTERNAL_CRON_SECRET || "";
  if (expected.length < 24) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resyncActiveSessions();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Internal reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
