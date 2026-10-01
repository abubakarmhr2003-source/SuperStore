import { NextResponse } from "next/server";
import { getSupabaseAdmin, usernameToEmail } from "@/lib/supabaseAdmin";
import { ensureSchema } from "@/lib/initDb";
import { verifyToken, withErrorHandling, ApiError } from "@/lib/auth";

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await verifyToken(req);
    const data = await req.json();
    const oldPassword = (data.old_password || "").toString();
    const newPassword = (data.new_password || "").toString();

    if (newPassword.length < 4) throw new ApiError(400, "Password min 4 characters");

    const supabase = getSupabaseAdmin();

    // Confirm the current password is correct before allowing the change.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(user.username),
      password: oldPassword,
    });
    if (signInError) throw new ApiError(400, "Current password is incorrect");

    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
    if (error) throw new ApiError(500, "Failed to update password: " + error.message);

    return NextResponse.json({ ok: true });
  });
}
