import { NextResponse } from "next/server";
import { verifyToken, withErrorHandling } from "@/lib/auth";
import { ensureSchema } from "@/lib/initDb";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    return NextResponse.json({ username: user.username, full_name: user.full_name, role: user.role });
  });
}
