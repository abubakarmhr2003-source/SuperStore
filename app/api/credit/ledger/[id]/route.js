import { NextResponse } from "next/server";
import { rows, query } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

// GET here treats [id] as a customer_id — mirrors GET /credit/ledger/{customer_id}
export async function GET(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const customerId = parseInt(params.id, 10);
    const list = await rows(
      "SELECT * FROM credit_ledger WHERE customer_id=$1 AND shop_id=$2 ORDER BY entry_date DESC",
      [customerId, user.shop_id]
    );
    return NextResponse.json(list);
  });
}

// DELETE here treats [id] as an entry_id — mirrors DELETE /credit/ledger/{entry_id}
export async function DELETE(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const entryId = parseInt(params.id, 10);
    await query("DELETE FROM credit_ledger WHERE id=$1 AND shop_id=$2", [entryId, user.shop_id]);
    return NextResponse.json({ ok: true });
  });
}
