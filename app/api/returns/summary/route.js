import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const today = new Date().toISOString().slice(0, 10);

    const totalRefund = await row("SELECT COALESCE(SUM(refund_amount),0) AS v FROM returns WHERE shop_id=$1", [user.shop_id]);
    const totalQty = await row("SELECT COALESCE(SUM(qty),0) AS v FROM returns WHERE shop_id=$1", [user.shop_id]);
    const count = await row("SELECT COUNT(*) AS v FROM returns WHERE shop_id=$1", [user.shop_id]);
    const todayRefund = await row(
      "SELECT COALESCE(SUM(refund_amount),0) AS v FROM returns WHERE shop_id=$1 AND return_date LIKE $2",
      [user.shop_id, `${today}%`]
    );

    return NextResponse.json({
      total_refund: Number(totalRefund.v),
      total_qty: Number(totalQty.v),
      count: Number(count.v),
      today_refund: Number(todayRefund.v),
    });
  });
}
