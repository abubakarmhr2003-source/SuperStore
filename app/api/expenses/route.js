import { NextResponse } from "next/server";
import { rows, row } from "@/lib/db";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const list = await rows("SELECT * FROM expenses WHERE shop_id=$1 ORDER BY expense_date DESC", [user.shop_id]);
    return NextResponse.json(list);
  });
}

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const data = await req.json();
    const exp = await row(
      "INSERT INTO expenses (shop_id,description,amount,added_by) VALUES ($1,$2,$3,$4) RETURNING *",
      [user.shop_id, data.description, data.amount, user.username]
    );
    return NextResponse.json(exp);
  });
}
