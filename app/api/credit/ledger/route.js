import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { verifyToken, withErrorHandling, ApiError } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const data = await req.json();
    const type = data.type;
    const amount = data.amount;
    const description = data.description || "";
    const saleId = data.sale_id ?? null;

    if (!["debit", "payment"].includes(type)) throw new ApiError(400, "Type must be debit or payment");
    if (amount <= 0) throw new ApiError(400, "Amount must be > 0");

    const customer = await row(
      "SELECT 1 FROM credit_customers WHERE id=$1 AND shop_id=$2",
      [data.customer_id, user.shop_id]
    );
    if (!customer) throw new ApiError(404, "Customer not found");

    const entry = await row(
      "INSERT INTO credit_ledger (shop_id,customer_id,type,amount,description,sale_id,added_by) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [user.shop_id, data.customer_id, type, amount, description, saleId, user.username]
    );
    return NextResponse.json(entry);
  });
}
