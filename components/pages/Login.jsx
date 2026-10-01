import { useState, useEffect } from "react";
import { api, settingsApi } from "../utils/api";
import { getShopInfo, setShopInfo } from "../utils/shopInfo";

export default function Login({ onLogin, onShowSignup, onShowOwnerSignup }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [shop, setShop]         = useState(getShopInfo());

  useEffect(() => {
    // Public/logged-out call just returns generic defaults in a multi-shop
    // app — the real shop branding shows up once you're actually logged in.
    settingsApi.get().then(s => { setShopInfo(s); setShop(getShopInfo()); }).catch(() => {});
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError("Please enter username and password"); return; }
    setLoading(true); setError("");
    try {
      const data = await api.login({ username: username.trim(), password });
      localStorage.setItem("gs_token", data.token);
      localStorage.setItem("gs_user", data.username);
      localStorage.setItem("gs_role", data.role || "staff");
      localStorage.setItem("gs_fullname", data.full_name || "");
      if (data.shop) setShopInfo(data.shop);
      onLogin(data.username, data.role, data.full_name, data.shop);
    } catch (e) { setError(e.message || "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <span className="login-logo">🏪</span>
        <h1 className="login-title">{shop.shop_name || "General Store"}</h1>
        <p className="login-sub">{shop.shop_tagline}</p>
        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" autoFocus autoComplete="username" />
          </div>
          <div className="login-field">
            <label>Password</label>
            <div className="pw-wrap">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁️"}</button>
            </div>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>
        {onShowSignup && (
          <div className="login-hint" style={{ marginTop: "8px" }}>
            Joining a shop that already uses this app?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); onShowSignup(); }}>Request a team account</a>
          </div>
        )}
        {onShowOwnerSignup && (
          <div className="login-hint" style={{ marginTop: "8px" }}>
            New here?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); onShowOwnerSignup(); }}>Register your own shop</a>
          </div>
        )}
      </div>
    </div>
  );
}
