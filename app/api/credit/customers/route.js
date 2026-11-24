import { NextResponse } from "next/server";
import { rows, row } from "@/lib/db";
import { verifyToken, withErrorHandling, ApiError } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    // One query for everyone (was 2 queries per customer, one after another).
    const list = await rows(
      `SELECT c.*,
              COALESCE(SUM(CASE WHEN l.type='debit'   THEN l.amount::float8 END),0) AS total_debit,
              COALESCE(SUM(CASE WHEN l.type='payment' THEN l.amount::float8 END),0) AS total_payment
         FROM credit_customers c
         LEFT JOIN credit_ledger l ON l.customer_id=c.id AND l.shop_id=c.shop_id
        WHERE c.shop_id=$1
        GROUP BY c.id
        ORDER BY c.name`,
      [user.shop_id]
    );
    const result = list.map(c => {
      const totalDebit = Number(c.total_debit), totalPayment = Number(c.total_payment);
      return { ...c, total_debit: totalDebit, total_payment: totalPayment, balance: totalDebit - totalPayment };
    });
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
