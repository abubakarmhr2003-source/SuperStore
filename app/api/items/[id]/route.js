import { NextResponse } from "next/server";
import { row, query } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function PUT(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const itemId = parseInt(params.id, 10);
    const data = await req.json();

    const fields = [];
    const vals = [];
    let i = 1;
    if (data.cost_price !== undefined && data.cost_price !== null) {
      fields.push(`cost_price=$${i++}`); vals.push(data.cost_price);
    }
    if (data.sale_price !== undefined && data.sale_price !== null) {
      fields.push(`sale_price=$${i++}`); vals.push(data.sale_price);
    }
    if (data.qty !== undefined && data.qty !== null) {
      fields.push(`qty=$${i++}`); vals.push(data.qty);
    }
    if (fields.length) {
      vals.push(itemId, user.shop_id);
      await query(`UPDATE items SET ${fields.join(",")} WHERE id=$${i} AND shop_id=$${i + 1}`, vals);
    }
    const item = await row("SELECT * FROM items WHERE id=$1 AND shop_id=$2", [itemId, user.shop_id]);
    return NextResponse.json(item);
  });
}

export async function DELETE(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const itemId = parseInt(params.id, 10);
    await query("DELETE FROM items WHERE id=$1 AND shop_id=$2", [itemId, user.shop_id]);
    return NextResponse.json({ ok: true });
  });
}
