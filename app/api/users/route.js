import { NextResponse } from "next/server";
import { rows, row } from "@/lib/db";
import { ensureSchema } from "@/lib/initDb";
import { getSupabaseAdmin, usernameToEmail } from "@/lib/supabaseAdmin";
import { requireAdmin, withErrorHandling, ApiError } from "@/lib/auth";

export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await requireAdmin(req);
    const list = await rows(
      "SELECT id,username,full_name,role,active,approved,created_at FROM profiles WHERE shop_id=$1 ORDER BY created_at",
      [user.shop_id]
    );
    return NextResponse.json(list);
  });
}

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await requireAdmin(req);
    const data = await req.json();
    const username = (data.username || "").toString().trim();
    const password = (data.password || "").toString();
    const fullName = (data.full_name || "").toString().trim();
    const role = data.role || "staff";

    // "owner" is reserved for whoever registered the shop itself — team
    // members created here are always admin or staff.
    if (!["admin", "staff"].includes(role)) throw new ApiError(400, "Role must be admin or staff");
    if (username.length < 3) throw new ApiError(400, "Username min 3 chars");
    if (password.length < 4) throw new ApiError(400, "Password min 4 chars");

    const dup = await row("SELECT 1 FROM profiles WHERE LOWER(username)=LOWER($1)", [username]);
    if (dup) throw new ApiError(400, "Username already exists");

    const supabase = getSupabaseAdmin();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
    });
    if (error) throw new ApiError(400, "Could not create account: " + error.message);

    const profile = await row(
      "INSERT INTO profiles (id,shop_id,username,full_name,role,active,approved) VALUES ($1,$2,$3,$4,$5,1,1) " +
      "RETURNING id,username,full_name,role,active,approved,created_at",
      [created.user.id, user.shop_id, username, fullName, role]
    );
    return NextResponse.json(profile);
  });
}
