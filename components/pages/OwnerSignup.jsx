import { useState } from "react";
import { api } from "../utils/api";

export default function OwnerSignup({ onBackToLogin }) {
  const [shopName, setShopName] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);
  const [shopCode, setShopCode] = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!shopName.trim()) { setError("Please enter your shop name"); return; }
    if (!username.trim() || !password.trim()) { setError("Please enter username and password"); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.ownerSignup({
        shop_name: shopName.trim(),
        username: username.trim(),
        password,
        full_name: fullName.trim(),
      });
      setShopCode(res.shop_code || "");
      setDone(true);
    } catch (e) { setError(e.message || "Registration failed"); }
    finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <span className="login-logo">✅</span>
          <h1 className="login-title">Shop Registered</h1>
          <p className="login-sub">
            Thanks! Your shop has been submitted for approval — you'll be able
            to log in once it's approved.
          </p>
          {shopCode && (
            <p className="login-sub" style={{ marginTop: "8px" }}>
              Your shop code is <strong>{shopCode}</strong> — save it, you'll
              need it later to invite your team.
            </p>
          )}
          <button className="login-btn" style={{ marginTop: "1rem" }} onClick={onBackToLogin}>
            ← Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <span className="login-logo">🏪</span>
        <h1 className="login-title">Register Your Shop</h1>
        <p className="login-sub">Create a new shop on this app</p>
        <form onSubmit={handleSignup} className="login-form">
          <div className="login-field">
            <label>Shop / Business Name</label>
            <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Khan General Store" autoFocus />
          </div>
          <div className="login-field">
            <label>Your Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. ahmed" autoComplete="username" />
          </div>
          <div className="login-field">
            <label>Your Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Ahmed Khan" />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" autoComplete="new-password" />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Submitting..." : "Register Shop →"}
          </button>
        </form>
        <div className="login-hint">
          ℹ️ New shops need a quick approval before their owner can log in.
        </div>
        <div className="login-hint" style={{ marginTop: "6px" }}>
          Already registered?{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>Log in</a>
        </div>
      </div>
    </div>
  );
}
