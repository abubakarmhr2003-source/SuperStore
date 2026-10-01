import { NextResponse } from "next/server";
import { rows, row, query } from "@/lib/db";
import { verifyToken, withErrorHandling, ApiError } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const list = await rows("SELECT * FROM returns WHERE shop_id=$1 ORDER BY return_date DESC", [user.shop_id]);
    return NextResponse.json(list);
  });
}

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const data = await req.json();
    const qty = data.qty;
    const refundAmount = data.refund_amount ?? 0;
    const reason = data.reason || "";
    const restock = data.restock !== false;
    const customer = data.customer || "";
    const saleId = data.sale_id ?? null;

    if (qty <= 0) throw new ApiError(400, "Quantity must be > 0");
    if (refundAmount < 0) throw new ApiError(400, "Refund amount cannot be negative");

    const item = await row("SELECT * FROM items WHERE id=$1 AND shop_id=$2", [data.item_id, user.shop_id]);
    if (!item) throw new ApiError(404, "Item not found");

    if (restock) {
      await query("UPDATE items SET qty=qty+$1 WHERE id=$2 AND shop_id=$3", [qty, data.item_id, user.shop_id]);
    }

    const created = await row(
      "INSERT INTO returns (shop_id,item_id,item_name,qty,refund_amount,reason,restocked,customer,sale_id,processed_by) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [user.shop_id, item.id, item.name, qty, refundAmount, reason, restock ? 1 : 0, customer, saleId, user.username]
    );
    return NextResponse.json(created);
  });
}
