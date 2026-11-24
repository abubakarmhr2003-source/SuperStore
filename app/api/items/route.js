import { NextResponse } from "next/server";
import { rows, row, query } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const list = await rows("SELECT * FROM items WHERE shop_id=$1 ORDER BY name", [user.shop_id]);
    return NextResponse.json(list);
  });
}

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const data = await req.json();
    const name = data.name;
    const category = data.category || "Other";
    const boxes = data.boxes ?? 1;
    const piecesPerBox = Math.max(1, Math.floor(+data.pieces_per_box || 1));
    // Prices are optional. Blank = not set (0 for a new item, keep the old price when restocking).
    const optPrice = v => (v === undefined || v === null || v === "" || !(+v >= 0)) ? null : +v;
    const costPrice = optPrice(data.cost_price);
    const salePrice = optPrice(data.sale_price);
    const totalQty = boxes * piecesPerBox;
    // Per-item alert level: "warn me when only this many pieces are left". Blank = keep / use 10.
    const limRaw = data.low_stock_limit;
    const lowLimit = limRaw === undefined || limRaw === null || limRaw === "" || !(+limRaw >= 0) ? null : Math.floor(+limRaw);

    const existing = await row(
      "SELECT * FROM items WHERE shop_id=$1 AND LOWER(name)=LOWER($2)",
      [user.shop_id, name]
    );
    let item;
    if (existing) {
      await query(
        "UPDATE items SET qty=qty+$1,cost_price=COALESCE($2,cost_price),sale_price=COALESCE($3,sale_price),low_stock_limit=COALESCE($6,low_stock_limit),pieces_per_box=CASE WHEN $7>1 THEN $7 ELSE COALESCE(pieces_per_box,1) END WHERE id=$4 AND shop_id=$5",
        [totalQty, costPrice, salePrice, existing.id, user.shop_id, lowLimit, piecesPerBox]
      );
      item = await row("SELECT * FROM items WHERE id=$1", [existing.id]);
    } else {
      item = await row(
        "INSERT INTO items (shop_id,name,category,qty,cost_price,sale_price,low_stock_limit,pieces_per_box) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [user.shop_id, name, category, totalQty, costPrice ?? 0, salePrice ?? 0, lowLimit ?? 10, piecesPerBox]
      );
    }
    return NextResponse.json(item);
  });
}
