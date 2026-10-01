import { NextResponse } from "next/server";
import { rows } from "@/lib/db";
import { ensureSchema } from "@/lib/initDb";
import { withErrorHandling, ApiError } from "@/lib/auth";

// This is YOUR (the platform owner's) private approval panel — separate from
// any shop's own login system entirely. Protected with a shared-secret key
// (set SUPERADMIN_SECRET in your env) rather than a normal account, since
// there's only ever one person using it.
function checkKey(req) {
  const key = req.headers.get("x-superadmin-key") || "";
  const expected = process.env.SUPERADMIN_SECRET || "";
  if (!expected || key !== expected) throw new ApiError(401, "Invalid superadmin key");
}

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    checkKey(req);
    const list = await rows(
      "SELECT id,slug,shop_name,approved,active,setup_complete,created_at FROM shops ORDER BY created_at DESC"
    );
    return NextResponse.json(list);
  });
}
