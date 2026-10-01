import { NextResponse } from "next/server";
import { row, query } from "@/lib/db";
import { verifyToken, withErrorHandling, ApiError } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function DELETE(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const saleId = parseInt(params.id, 10);
    const sale = await row("SELECT * FROM sales WHERE id=$1 AND shop_id=$2", [saleId, user.shop_id]);
    if (!sale) throw new ApiError(404, "Sale not found");

    const items = JSON.parse(sale.items_json);
    for (const i of items) {
      await query(
        "UPDATE items SET qty=qty+$1,sold=sold-$2 WHERE id=$3 AND shop_id=$4",
        [i.qty, i.qty, i.id, user.shop_id]
      );
    }
    await query("DELETE FROM sales WHERE id=$1 AND shop_id=$2", [saleId, user.shop_id]);
    return NextResponse.json({ ok: true });
  });
}
