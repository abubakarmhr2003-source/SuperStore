import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const tu = await row("SELECT COALESCE(SUM(amount),0) AS v FROM credit_ledger WHERE type='debit' AND shop_id=$1", [user.shop_id]);
    const tr = await row("SELECT COALESCE(SUM(amount),0) AS v FROM credit_ledger WHERE type='payment' AND shop_id=$1", [user.shop_id]);
    const tc = await row("SELECT COUNT(*) AS v FROM credit_customers WHERE shop_id=$1", [user.shop_id]);
    const od = await row(
      `SELECT COUNT(DISTINCT customer_id) AS v FROM (
        SELECT customer_id, SUM(CASE WHEN type='debit' THEN amount ELSE -amount END) AS bal
        FROM credit_ledger WHERE shop_id=$1 GROUP BY customer_id HAVING SUM(CASE WHEN type='debit' THEN amount ELSE -amount END) > 0
      ) sub`,
      [user.shop_id]
    );

    const totalUdhaar = Number(tu.v);
    const totalRecovered = Number(tr.v);
    return NextResponse.json({
      total_udhaar: totalUdhaar,
      total_recovered: totalRecovered,
      outstanding: totalUdhaar - totalRecovered,
      total_customers: Number(tc.v),
      overdue_customers: Number(od.v),
    });
  });
}
