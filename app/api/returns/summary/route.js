import { NextResponse } from "next/server";
import { row, rows } from "@/lib/db";
import { pkDay, utcCutoff } from "@/lib/pkTime";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const today = pkDay();   // Pakistan date, not UTC

    const totalRefund = await row("SELECT COALESCE(SUM(refund_amount),0) AS v FROM returns WHERE shop_id=$1", [user.shop_id]);
    const totalQty = await row("SELECT COALESCE(SUM(qty),0) AS v FROM returns WHERE shop_id=$1", [user.shop_id]);
    const count = await row("SELECT COUNT(*) AS v FROM returns WHERE shop_id=$1", [user.shop_id]);
    const recent = await rows(
      "SELECT return_date, refund_amount FROM returns WHERE shop_id=$1 AND return_date >= $2",
      [user.shop_id, utcCutoff(3)]
    );
    const todayRefund = { v: recent.filter(r => pkDay(r.return_date) === today).reduce((a, r) => a + (Number(r.refund_amount) || 0), 0) };

    return NextResponse.json({
      total_refund: Number(totalRefund.v),
      total_qty: Number(totalQty.v),
      count: Number(count.v),
      today_refund: Number(todayRefund.v),
    });
  });
}
