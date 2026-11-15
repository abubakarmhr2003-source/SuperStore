import { NextResponse } from "next/server";
import { row, rows } from "@/lib/db";
import { pkDay, lastPkDays, utcCutoff } from "@/lib/pkTime";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const sid = user.shop_id;
    const today = pkDay();                // Pakistan date, not UTC
    const days = lastPkDays(7);
    const cutoff = utcCutoff(9);

    // One round-trip to the database instead of a dozen.
    const r = await row(
      `SELECT
        (SELECT COALESCE(SUM(profit),0)::float8        FROM sales    WHERE shop_id=$1) AS tp,
        (SELECT COALESCE(SUM(amount),0)::float8        FROM expenses WHERE shop_id=$1) AS te,
        (SELECT COALESCE(SUM(refund_amount),0)::float8 FROM returns  WHERE shop_id=$1) AS tr,
        (SELECT COALESCE(SUM(total),0)::float8         FROM sales    WHERE shop_id=$1) AS revenue,
        (SELECT COUNT(*)::int                          FROM sales    WHERE shop_id=$1) AS sales_count,
        (SELECT COALESCE(SUM(qty*cost_price),0)::float8 FROM items   WHERE shop_id=$1) AS stock_value,
        (SELECT COUNT(*)::int FROM items WHERE shop_id=$1 AND qty>0 AND qty<=COALESCE(low_stock_limit,10)) AS low_stock,
        (SELECT COUNT(*)::int FROM items WHERE shop_id=$1 AND qty=0)            AS out_of_stock,
        (SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END),0)::float8 FROM credit_ledger WHERE shop_id=$1) AS total_credit`,
      [sid]
    );

    // Recent sales / credit entries, grouped by Pakistan calendar day.
    const recentSales = await rows("SELECT sale_date, total, profit FROM sales WHERE shop_id=$1 AND sale_date >= $2", [sid, cutoff]);
    const recentCredit = await rows("SELECT entry_date, amount FROM credit_ledger WHERE shop_id=$1 AND type='debit' AND entry_date >= $2", [sid, cutoff]);
    const byDay = Object.fromEntries(days.map(d => [d, { day: d, revenue: 0, profit: 0 }]));
    for (const s of recentSales) {
      const b = byDay[pkDay(s.sale_date)];
      if (b) { b.revenue += Number(s.total) || 0; b.profit += Number(s.profit) || 0; }
    }
    const todayCredit = recentCredit
      .filter(e => pkDay(e.entry_date) === today)
      .reduce((a, e) => a + (Number(e.amount) || 0), 0);

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
      today_revenue: byDay[today]?.revenue ?? 0,
      today_profit: byDay[today]?.profit ?? 0,
      today_credit: todayCredit,
      week: days.map(d => byDay[d]),
      total_credit: r.total_credit,
    });
  });
}
