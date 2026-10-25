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

// Edit an existing sale: customer name + item lines (qty / discount / remove / add).
// Stock is adjusted by the difference between the old and the new quantities.
export async function PUT(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const saleId = parseInt(params.id, 10);
    const sale = await row("SELECT * FROM sales WHERE id=$1 AND shop_id=$2", [saleId, user.shop_id]);
    if (!sale) throw new ApiError(404, "Sale not found");

    const data = await req.json();
    const customer = (data.customer || "").trim() || "Walk-in Customer";
    const incoming = Array.isArray(data.items) ? data.items : [];
    if (!incoming.length) throw new ApiError(400, "A sale needs at least one item (delete the sale instead)");

    const oldItems = JSON.parse(sale.items_json);
    const oldById = new Map(oldItems.map((i) => [i.id, i]));

    // Build the new item list. Existing lines keep their original prices
    // (history stays accurate); newly added lines use the current item price.
    const newItems = [];
    const seen =
