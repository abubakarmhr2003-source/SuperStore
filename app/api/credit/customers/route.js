import { NextResponse } from "next/server";
import { rows, row } from "@/lib/db";
import { verifyToken, withErrorHandling, ApiError } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const customers = await rows("SELECT * FROM credit_customers WHERE shop_id=$1 ORDER BY name", [user.shop_id]);
    const result = [];
    for (const c of customers) {
      const td = await row(
        "SELECT COALESCE(SUM(amount),0) AS v FROM credit_ledger WHERE customer_id=$1 AND type='debit' AND shop_id=$2",
        [c.id, user.shop_id]
      );
      const tp = await row(
        "SELECT COALESCE(SUM(amount),0) AS v FROM credit_ledger WHERE customer_id=$1 AND type='payment' AND shop_id=$2",
        [c.id, user.shop_id]
      );
      const totalDebit = Number(td.v);
      const totalPayment = Number(tp.v);
      result.push({ ...c, total_debit: totalDebit, total_payment: totalPayment, balance: totalDebit - totalPayment });
    }
    return NextResponse.json(result);
  });
}

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const data = await req.json();
    const name = data.name;
    const phone = data.phone || "";
    const address = data.address || "";
    const notes = data.notes || "";

    const dup = await row(
      "SELECT 1 FROM credit_customers WHERE shop_id=$1 AND LOWER(name)=LOWER($2)",
      [user.shop_id, name]
    );
    if (dup) throw new ApiError(400, "Customer already exists");

    const created = await row(
      "INSERT INTO credit_customers (shop_id,name,phone,address,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [user.shop_id, name, phone, address, notes]
    );
    return NextResponse.json({ ...created, total_debit: 0, total_payment: 0, balance: 0 });
  });
}
