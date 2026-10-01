import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function DELETE(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    await query("DELETE FROM expenses WHERE id=$1 AND shop_id=$2", [parseInt(params.id, 10), user.shop_id]);
    return NextResponse.json({ ok: true });
  });
}
