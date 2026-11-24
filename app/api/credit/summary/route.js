import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const [t, od] = await Promise.all([
      row(
        `SELECT COALESCE(SUM(CASE WHEN type='debit'   THEN amount::float8 END),0) AS debit,
                COALESCE(SUM(CASE WHEN type='payment' THEN amount::float8 END),0) AS paid,
                (SELECT COUNT(*) FROM credit_customers WHERE shop_id=$1) AS customers
           FROM credit_ledger WHERE shop_id=$1`,
        [user.shop_id]
      ),
      row(
        `SELECT COUNT(*) AS v FROM (
           SELECT customer_id FROM credit_ledger WHERE shop_id=$1
            GROUP BY customer_id
           HAVING SUM(CASE WHEN type='debit' THEN amount ELSE -amount END) > 0
         ) sub`,
        [user.shop_id]
      ),
    ]);

    const totalUdhaar = Number(t.debit);
    const totalRecovered = Number(t.paid);
    return NextResponse.json({
      total_udhaar: totalUdhaar,
      total_recovered: totalRecovered,
      outstanding: totalUdhaar - totalRecovered,
      total_customers: Number(t.customers),
      overdue_customers: Number(od.v),
    });
  });
}
