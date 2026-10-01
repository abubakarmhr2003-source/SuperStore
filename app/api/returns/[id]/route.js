import { NextResponse } from "next/server";
import { row, query } from "@/lib/db";
import { verifyToken, withErrorHandling, ApiError } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function DELETE(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const returnId = parseInt(params.id, 10);
    const r = await row("SELECT * FROM returns WHERE id=$1 AND shop_id=$2", [returnId, user.shop_id]);
    if (!r) throw new ApiError(404, "Return not found");

    if (r.restocked) {
      // Undo the restock since this return record is being removed
      await query("UPDATE items SET qty=GREATEST(qty-$1,0) WHERE id=$2 AND shop_id=$3", [r.qty, r.item_id, user.shop_id]);
    }
    await query("DELETE FROM returns WHERE id=$1 AND shop_id=$2", [returnId, user.shop_id]);
    return NextResponse.json({ ok: true });
  });
}
