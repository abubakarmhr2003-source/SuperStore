import { NextResponse } from "next/server";
import { rows, row, query } from "@/lib/db";
import { verifyToken, withErrorHandling, ApiError } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const list = await rows("SELECT * FROM sales WHERE shop_id=$1 ORDER BY sale_date DESC", [user.shop_id]);
    const result = list.map((r) => ({ ...r, items_json: JSON.parse(r.items_json) }));
    return NextResponse.json(result);
  });
}

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const data = await req.json();
    const customer = data.customer || "Walk-in Customer";
    const items = data.items || [];

    const saleItems = [];
    let total = 0;
    let profit = 0;

    for (const bi of items) {
      const item = await row("SELECT * FROM items WHERE id=$1 AND shop_id=$2", [bi.item_id, user.shop_id]);
      if (!item) throw new ApiError(400, `Item ${bi.item_id} not found`);
      if (item.qty < bi.qty) throw new ApiError(400, `Not enough stock for ${item.name}`);

      const gross = item.sale_price * bi.qty;
      const disc = Math.max(0, Math.min(bi.discount || 0, gross));
      const lt = gross - disc;
      const lp = lt - item.cost_price * bi.qty;
      total += lt;
      profit += lp;

      saleItems.push({
        id: item.id, name: item.name, qty: bi.qty,
        sale_price: item.sale_price, cost_price: item.cost_price,
        discount: disc, line_total: lt,
      });

      await query(
        "UPDATE items SET qty=qty-$1,sold=sold+$2 WHERE id=$3 AND shop_id=$4",
        [bi.qty, bi.qty, bi.item_id, user.shop_id]
      );
    }

    const sale = await row(
      "INSERT INTO sales (shop_id,customer,items_json,total,profit,sold_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [user.shop_id, customer, JSON.stringify(saleItems), total, profit, user.username]
    );
    return NextResponse.json({ ...sale, items_json: JSON.parse(sale.items_json) });
  });
}
