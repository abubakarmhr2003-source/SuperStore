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
    const seen = new Set();
    for (const bi of incoming) {
      const id = +bi.id;
      const qty = Math.floor(+bi.qty);
      if (!id || !(qty >= 1)) throw new ApiError(400, "Every item needs a quantity of at least 1");
      if (seen.has(id)) throw new ApiError(400, "Same item added twice");
      seen.add(id);

      let name, sale_price, cost_price;
      const old = oldById.get(id);
      if (old) {
        ({ name, sale_price, cost_price } = old);
      } else {
        const item = await row("SELECT * FROM items WHERE id=$1 AND shop_id=$2", [id, user.shop_id]);
        if (!item) throw new ApiError(400, `Item ${id} not found`);
        ({ name, sale_price, cost_price } = item);
      }
      const gross = sale_price * qty;
      const discount = Math.max(0, Math.min(+bi.discount || 0, gross));
      newItems.push({
        id, name, qty, sale_price, cost_price, discount,
        line_total: gross - discount,
      });
    }

    // Work out the stock change per item (positive = more units leave stock).
    const delta = new Map();
    for (const o of oldItems) delta.set(o.id, -o.qty);
    for (const n of newItems) delta.set(n.id, (delta.get(n.id) || 0) + n.qty);

    // Validate all stock first so nothing is half-applied.
    for (const [id, d] of delta) {
      if (d <= 0) continue;
      const item = await row("SELECT name, qty FROM items WHERE id=$1 AND shop_id=$2", [id, user.shop_id]);
      if (!item) throw new ApiError(400, `Item ${id} not found`);
      if (item.qty < d) throw new ApiError(400, `Not enough stock for ${item.name} (only ${item.qty} more available)`);
    }
    for (const [id, d] of delta) {
      if (d === 0) continue;
      await query(
        "UPDATE items SET qty=qty-$1, sold=sold+$1 WHERE id=$2 AND shop_id=$3",
        [d, id, user.shop_id]
      );
    }

    const total = newItems.reduce((a, i) => a + i.line_total, 0);
    const profit = newItems.reduce((a, i) => a + i.line_total - i.cost_price * i.qty, 0);

    const updated = await row(
      "UPDATE sales SET customer=$1, items_json=$2, total=$3, profit=$4 WHERE id=$5 AND shop_id=$6 RETURNING *",
      [customer, JSON.stringify(newItems), total, profit, saleId, user.shop_id]
    );

    // If this was a credit (udhaar) sale, keep the credit book in sync.
    await query(
      "UPDATE credit_ledger SET amount=$1 WHERE sale_id=$2 AND type='debit' AND shop_id=$3",
      [total, saleId, user.shop_id]
    );

    return NextResponse.json({ ...updated, items_json: JSON.parse(updated.items_json) });
  });
}
