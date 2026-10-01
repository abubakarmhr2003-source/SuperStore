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
    const piecesPerBox = data.pieces_per_box ?? 1;
    const costPrice = data.cost_price;
    const salePrice = data.sale_price;
    const totalQty = boxes * piecesPerBox;

    const existing = await row(
      "SELECT * FROM items WHERE shop_id=$1 AND LOWER(name)=LOWER($2)",
      [user.shop_id, name]
    );
    let item;
    if (existing) {
      await query(
        "UPDATE items SET qty=qty+$1,cost_price=$2,sale_price=$3 WHERE id=$4 AND shop_id=$5",
        [totalQty, costPrice, salePrice, existing.id, user.shop_id]
      );
      item = await row("SELECT * FROM items WHERE id=$1", [existing.id]);
    } else {
      item = await row(
        "INSERT INTO items (shop_id,name,category,qty,cost_price,sale_price) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        [user.shop_id, name, category, totalQty, costPrice, salePrice]
      );
    }
    return NextResponse.json(item);
  });
}
