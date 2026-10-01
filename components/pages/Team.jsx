import { useEffect, useState, useRef } from "react";
import { userApi } from "../utils/api";

export default function Team({ currentUsername }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [resetId, setResetId] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const mounted = useRef(true);

  const [form, setForm] = useState({ username: "", password: "", full_name: "", role: "staff" });

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const load = () => userApi.list().then(d => { if (mounted.current) { setUsers(d); setLoading(false); } });

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);

  const handleAdd = async () => {
    if (!form.username.trim() || !form.password) return notify("❌ Username and password are required");
    try {
      await userApi.create({ ...form, username: form.username.trim(), full_name: form.full_name.trim() });
      setForm({ username: "", password: "", full_name: "", role: "staff" });
      setShowAdd(false);
      load();
      notify(`✅ Account "${form.username}" created!`);
    } catch (e) { notify("❌ " + e.message); }
  };

  const toggleActive = async (u) => {
    try {
      await userApi.update(u.id, { active: !u.active });
      load();
      notify(u.active ? `🔒 ${u.username} disabled` : `✅ ${u.username} enabled`);
    } catch (e) { notify("❌ " + e.message); }
  };

  const toggleRole = async (u) => {
    const newRole = u.role === "admin" ? "staff" : "admin";
    if (!confirm(`Change ${u.username}'s role to ${newRole}?`)) return;
    try {
      await userApi.update(u.id, { role: newRole });
      load();
      notify(`✅ ${u.username} is now ${newRole}`);
    } catch (e) { notify("❌ " + e.message); }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Delete account "${u.username}"? This cannot be undone.`)) return;
    try {
      await userApi.remove(u.id);
      load();
      notify(`🗑️ ${u.username} deleted`);
    } catch (e) { notify("❌ " + e.message); }
  };

  const handleReset = async (id) => {
    if (!resetPw || resetPw.length < 4) return notify("❌ Password must be at least 4 characters");
    try {
      await userApi.update(id, { password: resetPw });
      setResetId(null); setResetPw("");
      notify("✅ Password reset successfully");
    } catch (e) { notify("❌ " + e.message); }
  };

  const handleApprove = async (u) => {
    try {
      await userApi.update(u.id, { approved: true, active: true });
      load();
      notify(`✅ ${u.username} approved — can now log in`);
    } catch (e) { notify("❌ " + e.message); }
  };

  const handleReject = async (u) => {
    if (!confirm(`Reject and delete the request from "${u.username}"?`)) return;
    try {
      await userApi.remove(u.id);
      load();
      notify(`🗑️ Request from ${u.username} rejected`);
    } catch (e) { notify("❌ " + e.message); }
  };

  if (loading) return <div className="page"><div className="loading">Loading team...</div></div>;

  const pending = users.filter(u => !u.approved);
  const active = users.filter(u => u.approved);

  return (
    <div className="page">
      {msg && <div className="toast">{msg}</div>}

      <div className="page-header">
        <h1>👥 Team Members</h1>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "✕ Cancel" : "+ Add Team Member"}
        </button>
      </div>

      {/* Add member form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: "1.25rem", maxWidth: "520px" }}>
          <h2 className="card-title">New Account</h2>
          <div className="row-2">
            <div>
              <label>Username *</label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. ahmed" autoFocus />
            </div>
            <div>
              <label>Full Name</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Ahmed Khan" />
            </div>
          </div>
          <div className="row-2">
            <div>
              <label>Password *</label>
              <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 4 characters" />
            </div>
            <div>
              <label>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="calc-box">
            {form.role === "admin"
              ? "🛡️ Admin: full access including Team management, Reports & settings."
              : "👤 Staff: can use Billing, Stock, Sales Log, Credit Book — cannot manage team or view financial reports."}
          </div>
          <button className="btn-primary full-width" onClick={handleAdd}>Create Account</button>
        </div>
      )}

      {/* Pending approval requests */}
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: "1.25rem", borderColor: "var(--amber)" }}>
          <h2 className="card-title">⏳ Pending Approval ({pending.length})</h2>
          <div className="table-wrap">
            <table className="main-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(u => (
                  <tr key={u.id}>
                    <td className="bold">{u.username}</td>
                    <td className="muted">{u.full_name || "—"}</td>
                    <td className="muted" style={{ fontSize: "11px" }}>{new Date(u.created_at).toLocaleString()}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn-sm btn-success" onClick={() => handleApprove(u)}>✅ Approve</button>{" "}
                      <button className="btn-sm btn-danger" onClick={() => handleReject(u)}>✕ Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="card">
        <h2 className="card-title">All Accounts ({active.length})</h2>
        <div className="table-wrap">
          <table className="main-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map(u => (
                <tr key={u.id}>
                  <td className="bold">
                    {u.username}
                    {u.username === currentUsername && <span className="badge green" style={{ marginLeft: "6px" }}>You</span>}
                  </td>
                  <td className="muted">{u.full_name || "—"}</td>
                  <td>
                    <button
                      className={`badge ${u.role === "admin" ? "orange" : "green"}`}
                      style={{ border: "none", cursor: u.username === currentUsername ? "default" : "pointer" }}
                      onClick={() => u.username !== currentUsername && toggleRole(u)}
                      disabled={u.username === currentUsername}
                      title={u.username === currentUsername ? "" : "Click to toggle role"}
                    >
                      {u.role === "admin" ? "🛡️ Admin" : "👤 Staff"}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${u.active ? "green" : "red"}`}>
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: "11px" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {resetId === u.id ? (
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <input
                          type="text"
                          value={resetPw}
                          onChange={e => setResetPw(e.target.value)}
                          placeholder="New password"
                          style={{ width: "110px", marginBottom: 0, padding: "5px 8px" }}
                          autoFocus
                        />
                        <button className="btn-sm btn-success" onClick={() => handleReset(u.id)}>Save</button>
                        <button className="btn-sm" onClick={() => { setResetId(null); setResetPw(""); }}>×</button>
                      </div>
                    ) : (
                      <>
                        <button className="btn-sm btn-edit" onClick={() => { setResetId(u.id); setResetPw(""); }}>🔑 Reset PW</button>
                        {u.username !== currentUsername && (
                          <>
                            <button className="btn-sm" onClick={() => toggleActive(u)}>
                              {u.active ? "🔒 Disable" : "✅ Enable"}
                            </button>
                            <button className="btn-sm btn-danger" onClick={() => handleDelete(u)}>Delete</button>
                          </>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="card-title">ℹ️ Role Permissions</h2>
        <div className="two-col">
          <div>
            <div style={{ fontWeight: 700, marginBottom: "6px" }}>🛡️ Admin</div>
            <div style={{ fontSize: "13px", color: "var(--text2)", lineHeight: 1.7 }}>
              Full access — Dashboard, Stock, Billing, Sales Log, Profit &amp; Loss, Credit Book, Reports, and Team management.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: "6px" }}>👤 Staff</div>
            <div style={{ fontSize: "13px", color: "var(--text2)", lineHeight: 1.7 }}>
              Day-to-day operations — Dashboard, Stock, Billing, Sales Log, Credit Book. Cannot view Reports/Profit &amp; Loss or manage team accounts.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
