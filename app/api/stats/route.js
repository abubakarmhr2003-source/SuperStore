import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

async function scalar(sql, params = []) {
  const r = await row(sql, params);
  return Number(Object.values(r)[0]);
}

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const sid = user.shop_id;
    const today = new Date().toISOString().slice(0, 10);

    const tp = await scalar("SELECT COALESCE(SUM(profit),0) FROM sales WHERE shop_id=$1", [sid]);
    const te = await scalar("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE shop_id=$1", [sid]);
    const tr = await scalar("SELECT COALESCE(SUM(refund_amount),0) FROM returns WHERE shop_id=$1", [sid]);

    const result = {
      total_revenue: await scalar("SELECT COALESCE(SUM(total),0) FROM sales WHERE shop_id=$1", [sid]),
      total_profit: tp,
      total_expenses: te,
      total_returns: tr,
      net_profit: tp - te - tr,
      total_sales_count: await scalar("SELECT COUNT(*) FROM sales WHERE shop_id=$1", [sid]),
      stock_value: await scalar("SELECT COALESCE(SUM(qty*cost_price),0) FROM items WHERE shop_id=$1", [sid]),
      low_stock: await scalar("SELECT COUNT(*) FROM items WHERE qty<10 AND qty>0 AND shop_id=$1", [sid]),
      out_of_stock: await scalar("SELECT COUNT(*) FROM items WHERE qty=0 AND shop_id=$1", [sid]),
      today_revenue: await scalar("SELECT COALESCE(SUM(total),0) FROM sales WHERE shop_id=$1 AND sale_date LIKE $2", [sid, `${today}%`]),
      today_profit: await scalar("SELECT COALESCE(SUM(profit),0) FROM sales WHERE shop_id=$1 AND sale_date LIKE $2", [sid, `${today}%`]),
    };
    return NextResponse.json(result);
  });
}
