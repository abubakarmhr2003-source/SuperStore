import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const sid = user.shop_id;
    const today = new Date().toISOString().slice(0, 10);

    // One round-trip to the database instead of a dozen.
    const r = await row(
      `SELECT
        (SELECT COALESCE(SUM(profit),0)::float8        FROM sales    WHERE shop_id=$1) AS tp,
        (SELECT COALESCE(SUM(amount),0)::float8        FROM expenses WHERE shop_id=$1) AS te,
        (SELECT COALESCE(SUM(refund_amount),0)::float8 FROM returns  WHERE shop_id=$1) AS tr,
        (SELECT COALESCE(SUM(total),0)::float8         FROM sales    WHERE shop_id=$1) AS revenue,
        (SELECT COUNT(*)::int                          FROM sales    WHERE shop_id=$1) AS sales_count,
        (SELECT COALESCE(SUM(qty*cost_price),0)::float8 FROM items   WHERE shop_id=$1) AS stock_value,
        (SELECT COUNT(*)::int FROM items WHERE shop_id=$1 AND qty<10 AND qty>0) AS low_stock,
        (SELECT COUNT(*)::int FROM items WHERE shop_id=$1 AND qty=0)            AS out_of_stock,
        (SELECT COALESCE(SUM(total),0)::float8  FROM sales WHERE shop_id=$1 AND sale_date LIKE $2) AS today_revenue,
        (SELECT COALESCE(SUM(profit),0)::float8 FROM sales WHERE shop_id=$1 AND sale_date LIKE $2) AS today_profit`,
      [sid, `${today}%`]
    );

    return NextResponse.json({
      total_revenue: r.revenue,
      total_profit: r.tp,
      total_expenses: r.te,
      total_returns: r.tr,
      net_profit: r.tp - r.te - r.tr,
      total_sales_count: r.sales_count,
      stock_value: r.stock_value,
      low_stock: r.low_stock,
      out_of_stock: r.out_of_stock,
      today_revenue: r.today_revenue,
      today_profit: r.today_profit,
    });
  });
}
