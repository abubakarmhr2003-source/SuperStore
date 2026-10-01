import { NextResponse } from "next/server";
import { row, query } from "@/lib/db";
import { ensureSchema } from "@/lib/initDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin, withErrorHandling, ApiError } from "@/lib/auth";

export async function PUT(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const admin = await requireAdmin(req);
    const uid = params.id; // Supabase Auth UUID
    const data = await req.json();

    const target = await row("SELECT * FROM profiles WHERE id=$1 AND shop_id=$2", [uid, admin.shop_id]);
    if (!target) throw new ApiError(404, "User not found");
    if (target.role === "owner") throw new ApiError(400, "The shop owner account can't be modified here");

    if ((data.role === "staff" || data.active === false) && target.role === "admin") {
      const cnt = await row(
        "SELECT COUNT(*) AS c FROM profiles WHERE shop_id=$1 AND role IN ('admin','owner') AND active=1 AND id!=$2",
        [admin.shop_id, uid]
      );
      if (parseInt(cnt.c, 10) === 0) throw new ApiError(400, "Cannot remove last active admin");
    }

    const fields = [];
    const vals = [];
    let i = 1;
    if (data.full_name !== undefined && data.full_name !== null) {
      fields.push(`full_name=$${i++}`); vals.push(data.full_name.trim());
    }
    if (data.role !== undefined && data.role !== null) {
      if (!["admin", "staff"].includes(data.role)) throw new ApiError(400, "Role must be admin or staff");
      fields.push(`role=$${i++}`); vals.push(data.role);
    }
    if (data.active !== undefined && data.active !== null) {
      fields.push(`active=$${i++}`); vals.push(data.active ? 1 : 0);
    }
    if (data.approved !== undefined && data.approved !== null) {
      fields.push(`approved=$${i++}`); vals.push(data.approved ? 1 : 0);
    }
    if (fields.length) {
      vals.push(uid, admin.shop_id);
      await query(`UPDATE profiles SET ${fields.join(",")} WHERE id=$${i} AND shop_id=$${i + 1}`, vals);
    }

    const supabase = getSupabaseAdmin();
    if (data.password !== undefined && data.password !== null) {
      if (data.password.length < 4) throw new ApiError(400, "Password too short");
      const { error } = await supabase.auth.admin.updateUserById(uid, { password: data.password });
      if (error) throw new ApiError(500, "Failed to update password: " + error.message);
    }
    if (data.active === false) {
      // Also block them at the Supabase Auth level, not just our profile flag.
      await supabase.auth.admin.updateUserById(uid, { ban_duration: "876000h" });
    } else if (data.active === true) {
      await supabase.auth.admin.updateUserById(uid, { ban_duration: "none" });
    }

    const updated = await row(
      "SELECT id,username,full_name,role,active,approved,created_at FROM profiles WHERE id=$1",
      [uid]
    );
    return NextResponse.json(updated);
  });
}

export async function DELETE(req, { params }) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const admin = await requireAdmin(req);
    const uid = params.id;

    const target = await row("SELECT * FROM profiles WHERE id=$1 AND shop_id=$2", [uid, admin.shop_id]);
    if (!target) throw new ApiError(404, "User not found");
    if (uid === admin.id) throw new ApiError(400, "Cannot delete own account");
    if (target.role === "owner") throw new ApiError(400, "The shop owner account can't be deleted here");
    if (target.role === "admin") {
      const cnt = await row(
        "SELECT COUNT(*) AS c FROM profiles WHERE shop_id=$1 AND role IN ('admin','owner') AND active=1",
        [admin.shop_id]
      );
      if (parseInt(cnt.c, 10) <= 1) throw new ApiError(400, "Cannot delete last admin");
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) throw new ApiError(500, "Failed to delete account: " + error.message);

    await query("DELETE FROM profiles WHERE id=$1", [uid]);
    return NextResponse.json({ ok: true });
  });
}
