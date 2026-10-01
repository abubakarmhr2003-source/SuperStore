import { NextResponse } from "next/server";
import { query, row } from "@/lib/db";
import { ensureSchema } from "@/lib/initDb";
import { withErrorHandling, ApiError } from "@/lib/auth";

function checkKey(req) {
  const key = req.headers.get("x-superadmin-key") || "";
  const expected = process.env.SUPERADMIN_SECRET || "";
  if (!expected || key !== expected) throw new ApiError(401, "Invalid superadmin key");
}

export async function PUT(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    checkKey(req);
    const shopId = parseInt(params.id, 10);
    const data = await req.json();

    const fields = [];
    const vals = [];
    let i = 1;
    if (data.approved !== undefined && data.approved !== null) {
      fields.push(`approved=$${i++}`); vals.push(data.approved ? 1 : 0);
    }
    if (data.active !== undefined && data.active !== null) {
      fields.push(`active=$${i++}`); vals.push(data.active ? 1 : 0);
    }
    if (fields.length) {
      vals.push(shopId);
      await query(`UPDATE shops SET ${fields.join(",")} WHERE id=$${i}`, vals);
    }
    const shop = await row("SELECT id,slug,shop_name,approved,active,setup_complete,created_at FROM shops WHERE id=$1", [shopId]);
    if (!shop) throw new ApiError(404, "Shop not found");
    return NextResponse.json(shop);
  });
}
