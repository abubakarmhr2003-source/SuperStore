import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/initDb";

// Never prerender at build time — this route talks to the database.
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  return NextResponse.json({ message: "General Store API running (Next.js + Supabase)" });
}
