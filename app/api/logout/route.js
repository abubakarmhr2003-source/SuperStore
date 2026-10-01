import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/auth";

// Supabase Auth access tokens are short-lived JWTs — there's no server-side
// session to delete. The frontend just clears its stored token; this route
// exists so the same POST /logout call the UI already makes keeps working.
export async function POST() {
  return withErrorHandling(async () => {
    return NextResponse.json({ ok: true });
  });
}
