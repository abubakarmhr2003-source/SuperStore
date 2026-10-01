import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { row } from "./db";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getBearerToken(req) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function loadProfile(userId) {
  return row("SELECT * FROM profiles WHERE id=$1", [userId]);
}

// Verifies the Supabase Auth JWT sent by the frontend, then loads our own
// role/username/full_name/shop info from the "profiles" + "shops" tables
// (Supabase Auth itself only knows about email/password — roles and shop
// membership are ours to manage).
export async function verifyToken(req) {
  const token = getBearerToken(req);
  if (!token) throw new ApiError(401, "Invalid or expired session. Please login again.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new ApiError(401, "Invalid or expired session. Please login again.");

  const profile = await loadProfile(data.user.id);
  if (!profile) throw new ApiError(401, "Account profile not found. Contact admin.");
  if (!profile.approved) throw new ApiError(403, "Your account is pending admin approval.");
  if (!profile.active) throw new ApiError(403, "Account disabled. Contact admin.");

  const shop = profile.shop_id ? await row("SELECT * FROM shops WHERE id=$1", [profile.shop_id]) : null;
  if (!shop) throw new ApiError(403, "No shop is linked to this account. Contact support.");
  if (!shop.approved) throw new ApiError(403, "Your shop is still pending approval. You'll get access once it's approved.");
  if (!shop.active) throw new ApiError(403, "This shop has been disabled. Contact support.");

  return {
    id: data.user.id,
    username: profile.username,
    full_name: profile.full_name,
    role: profile.role,
    shop_id: profile.shop_id,
    shop,
  };
}

export async function requireAdmin(req) {
  const user = await verifyToken(req);
  if (user.role !== "admin" && user.role !== "owner") throw new ApiError(403, "Admin access required");
  return user;
}

// Like verifyToken, but returns null instead of throwing.
export async function getOptionalUser(req) {
  try {
    return await verifyToken(req);
  } catch {
    return null;
  }
}

// Wrap a route handler body in this to get FastAPI-style error responses:
// { detail: "..." } with the right status code.
export async function withErrorHandling(fn) {
  try {
    return await fn();
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    const message = e instanceof ApiError ? e.message : (e.message || "Server error");
    if (!(e instanceof ApiError)) console.error(e);
    return NextResponse.json({ detail: message }, { status });
  }
}
