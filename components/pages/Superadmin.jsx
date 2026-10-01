import { useState } from "react";
import { superadminApi } from "../utils/api";

export default function Superadmin({ onBack }) {
  const [key, setKey]           = useState(localStorage.getItem("gs_superadmin_key") || "");
  const [unlocked, setUnlocked] = useState(false);
  const [shops, setShops]       = useState([]);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const load = async (k) => {
    setLoading(true); setError("");
    try {
      const list = await superadminApi.listShops(k);
      setShops(list);
      setUnlocked(true);
      localStorage.setItem("gs_superadmin_key", k);
    } catch (e) {
      setError(e.message || "Invalid key");
      setUnlocked(false);
    } finally {
      setLoading(false);
    }
  };

  const setApproval = async (shop, approved) => {
    try {
      await superadminApi.updateShop(key, shop.id, { approved });
      load(key);
    } catch (e) { setError(e.message); }
  };

  const setActive = async (shop, active) => {
    try {
      await superadminApi.updateShop(key, shop.id, { active });
      load(key);
    } catch (e) { setError(e.message); }
  };

  if (!unlocked) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <span className="login-logo">🛡️</span>
          <h1 className="login-title">Superadmin</h1>
          <p className="login-sub">Enter your superadmin key to manage shop approvals</p>
          <form className="login-form" onSubmit={(e) => { e.preventDefault(); load(key); }}>
            <div className="login-field">
              <label>Superadmin Key</label>
              <input type="password" value={key} onChange={e => setKey(e.target.value)} autoFocus />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-btn" disabled={loading}>{loading ? "Checking..." : "Unlock →"}</button>
          </form>
          <div className="login-hint" style={{ marginTop: "8px" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back to Login</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>🛡️ Superadmin — Shop Approvals</h1>
      </div>
      {error && <div className="login-error">{error}</div>}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Shop</th><th>Code</th><th>Approved</th><th>Active</th><th>Registered</th><th></th>
            </tr>
          </thead>
          <tbody>
            {shops.map(s => (
              <tr key={s.id}>
                <td>{s.shop_name || <em>(unnamed)</em>}</td>
                <td>{s.slug}</td>
                <td>{s.approved ? "✅" : "⏳ Pending"}</td>
                <td>{s.active ? "✅" : "🔒 Disabled"}</td>
                <td>{new Date(s.created_at).toLocaleDateString()}</td>
                <td>
                  {!s.approved && <button className="btn-primary" onClick={() => setApproval(s, true)}>Approve</button>}
                  {s.approved && <button className="btn-outline" onClick={() => setApproval(s, false)}>Revoke</button>}
                  {" "}
                  {s.active
                    ? <button className="btn-outline" onClick={() => setActive(s, false)}>Disable</button>
                    : <button className="btn-primary" onClick={() => setActive(s, true)}>Enable</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: "16px" }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back to Login</a>
      </div>
    </div>
  );
}
