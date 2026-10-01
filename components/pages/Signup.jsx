import { useState, useEffect } from "react";
import { api, settingsApi } from "../utils/api";
import { getShopInfo, setShopInfo } from "../utils/shopInfo";

export default function Signup({ onBackToLogin }) {
  const [shopCode, setShopCode] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [shop, setShop]         = useState(getShopInfo());

  useEffect(() => {
    settingsApi.get().then(s => { setShopInfo(s); setShop(getShopInfo()); }).catch(() => {});
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!shopCode.trim()) { setError("Please enter your shop's code"); return; }
    if (!username.trim() || !password.trim()) { setError("Please enter username and password"); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters"); return; }
    setLoading(true); setError("");
    try {
      await api.signup({
        shop_code: shopCode.trim().toUpperCase(),
        username: username.trim(),
        password,
        full_name: fullName.trim(),
      });
      setDone(true);
    } catch (e) { setError(e.message || "Signup failed"); }
    finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <span className="login-logo">✅</span>
          <h1 className="login-title">Request Sent</h1>
          <p className="login-sub">
            Your account request has been submitted. An admin needs to approve it
            before you can log in — please check back shortly.
          </p>
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
        <h1 className="login-title">{shop.shop_name || "Join a Shop"}</h1>
        <p className="login-sub">Request a Team Account</p>
        <form onSubmit={handleSignup} className="login-form">
          <div className="login-field">
            <label>Shop Code</label>
            <input type="text" value={shopCode} onChange={e => setShopCode(e.target.value)} placeholder="e.g. KHN482 (ask your shop owner)" style={{ textTransform: "uppercase" }} autoFocus />
          </div>
          <div className="login-field">
            <label>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. ahmed" autoFocus autoComplete="username" />
          </div>
          <div className="login-field">
            <label>Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Ahmed Khan" />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" autoComplete="new-password" />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Submitting..." : "Request Account →"}
          </button>
        </form>
        <div className="login-hint">
          Already have an account?{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>Log in</a>
        </div>
        <div className="login-hint" style={{ marginTop: "6px" }}>
          ℹ️ An admin must approve your request before you can log in.
        </div>
      </div>
    </div>
  );
}
