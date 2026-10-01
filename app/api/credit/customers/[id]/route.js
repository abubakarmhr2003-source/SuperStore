import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function PUT(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const cid = parseInt(params.id, 10);
    const data = await req.json();

    const fields = [];
    const vals = [];
    let i = 1;
    if (data.name !== undefined && data.name !== null) { fields.push(`name=$${i++}`); vals.push(data.name); }
    if (data.phone !== undefined && data.phone !== null) { fields.push(`phone=$${i++}`); vals.push(data.phone); }
    if (data.address !== undefined && data.address !== null) { fields.push(`address=$${i++}`); vals.push(data.address); }
    if (data.notes !== undefined && data.notes !== null) { fields.push(`notes=$${i++}`); vals.push(data.notes); }

    if (fields.length) {
      vals.push(cid, user.shop_id);
      await query(`UPDATE credit_customers SET ${fields.join(",")} WHERE id=$${i} AND shop_id=$${i + 1}`, vals);
    }
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const cid = parseInt(params.id, 10);
    await query("DELETE FROM credit_ledger WHERE customer_id=$1 AND shop_id=$2", [cid, user.shop_id]);
    await query("DELETE FROM credit_customers WHERE id=$1 AND shop_id=$2", [cid, user.shop_id]);
    return NextResponse.json({ ok: true });
  });
}
