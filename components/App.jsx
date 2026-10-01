"use client";
import { useState, useEffect } from "react";
import Login        from "./pages/Login";
import Signup       from "./pages/Signup";
import OwnerSignup  from "./pages/OwnerSignup";
import Superadmin   from "./pages/Superadmin";
import SetupWizard  from "./pages/SetupWizard";
import Dashboard    from "./pages/Dashboard";
import Stock        from "./pages/Stock";
import Billing      from "./pages/Billing";
import History      from "./pages/History";
import Returns      from "./pages/Returns";
import ProfitLoss   from "./pages/ProfitLoss";
import Udhaar       from "./pages/Udhaar";
import Reports      from "./pages/Reports";
import Team         from "./pages/Team";
import Settings     from "./pages/Settings";
import { api } from "./utils/api";
import { getShopInfo, setShopInfo, isSetupComplete } from "./utils/shopInfo";

const PAGES = [
  { id: "dashboard", label: "Dashboard",    icon: "📊", roles: ["owner","admin","staff"] },
  { id: "stock",     label: "Stock",         icon: "📦", roles: ["owner","admin","staff"] },
  { id: "billing",   label: "Billing",       icon: "🧾", roles: ["owner","admin","staff"] },
  { id: "history",   label: "Sales Log",     icon: "📋", roles: ["owner","admin","staff"] },
  { id: "returns",   label: "Returns",       icon: "↩️", roles: ["owner","admin","staff"] },
  { id: "udhaar",    label: "Credit Book",   icon: "📒", roles: ["owner","admin","staff"] },
  { id: "pl",        label: "Profit & Loss", icon: "💹", roles: ["owner","admin"] },
  { id: "reports",   label: "Reports",       icon: "📈", roles: ["owner","admin"] },
  { id: "team",      label: "Team",          icon: "👥", roles: ["owner","admin"] },
  { id: "settings",  label: "Settings",      icon: "⚙️", roles: ["owner","admin"] },
];

const isAdminRole = (role) => role === "owner" || role === "admin";

export default function App() {
  const [user, setUser]             = useState(localStorage.getItem("gs_user") || "");
  const [role, setRole]             = useState(localStorage.getItem("gs_role") || "staff");
  const [fullName, setFullName]     = useState(localStorage.getItem("gs_fullname") || "");
  const [page, setPage]             = useState("dashboard");
  const [sideOpen, setSideOpen]     = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwData, setPwData]         = useState({ old_password: "", new_password: "" });
  const [pwMsg, setPwMsg]           = useState("");

  // Post-login setup wizard state — null = "still checking", true/false once known.
  // Unlike before, this is now checked AFTER login (per-shop), not globally
  // before anyone has authenticated, since there's no single "the shop" to
  // wizard-check pre-login in a multi-tenant app.
  const [setupDone, setSetupDone]   = useState(true);
  const [authScreen, setAuthScreen] = useState("login"); // "login" | "signup" | "ownerSignup" | "superadmin"
  const [shop, setShop]             = useState(getShopInfo());

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    const onLogout = () => setUser("");
    window.addEventListener("resize", onResize);
    window.addEventListener("auth:logout", onLogout);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("auth:logout", onLogout); };
  }, []);

  // Hidden entry point for the platform-owner approval panel: visit
  // "?superadmin" (or "?superadmin=1") on this app's URL.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("superadmin")) {
      setAuthScreen("superadmin");
    }
  }, []);

  const visiblePages = PAGES.filter(p => p.roles.includes(role));

  useEffect(() => {
    if (!visiblePages.find(p => p.id === page)) setPage("dashboard");
  }, [role]); // eslint-disable-line

  const handleLogin = (username, userRole, userFullName, shopData) => {
    setUser(username);
    setRole(userRole || "staff");
    setFullName(userFullName || "");
    setPage("dashboard");
    if (shopData) {
      setShop(getShopInfo());
      // Only the owner ever needs to see the branding wizard — staff/admin
      // just use whatever the owner has already configured.
      setSetupDone(userRole !== "owner" || isSetupComplete({ ...shopData, setup_complete: String(shopData.setup_complete) }));
    } else {
      setSetupDone(true);
    }
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch (_) {}
    localStorage.removeItem("gs_token");
    localStorage.removeItem("gs_user");
    localStorage.removeItem("gs_role");
    localStorage.removeItem("gs_fullname");
    setUser(""); setPage("dashboard"); setAuthScreen("login");
  };

  const navigate = (id) => { setPage(id); if (isMobile) setMobileOpen(false); };

  const changePw = async () => {
    if (!pwData.old_password || !pwData.new_password) { setPwMsg("❌ Both fields are required"); return; }
    try {
      await api.changePassword(pwData);
      setPwMsg("✅ Password changed successfully!");
      setTimeout(() => { setShowPwModal(false); setPwData({ old_password: "", new_password: "" }); setPwMsg(""); }, 1500);
    } catch (e) { setPwMsg("❌ " + e.message); }
  };

  if (authScreen === "superadmin" && !user) {
    return <Superadmin onBack={() => setAuthScreen("login")} />;
  }

  if (!user) {
    if (authScreen === "ownerSignup") return <OwnerSignup onBackToLogin={() => setAuthScreen("login")} />;
    if (authScreen === "signup") return <Signup onBackToLogin={() => setAuthScreen("login")} />;
    return (
      <Login
        onLogin={handleLogin}
        onShowSignup={() => setAuthScreen("signup")}
        onShowOwnerSignup={() => setAuthScreen("ownerSignup")}
      />
    );
  }

  // Owner's first login after their shop was approved: brand the shop once.
  if (!setupDone) {
    return (
      <SetupWizard
        onComplete={(updated) => {
          setShopInfo(updated);
          setShop(getShopInfo());
          setSetupDone(true);
        }}
      />
    );
  }

  const currentLabel = visiblePages.find(p => p.id === page)?.label || "";
  const sidebarCls = ["sidebar", !isMobile && !sideOpen ? "closed" : "", isMobile && mobileOpen ? "mobile-open" : ""].join(" ").trim();

  const handleSettingsUpdated = (updated) => {
    setShopInfo(updated);
    setShop(getShopInfo());
  };

  const renderPage = () => {
    if (page === "dashboard") return <Dashboard />;
    if (page === "stock")     return <Stock />;
    if (page === "billing")   return <Billing />;
    if (page === "history")   return <History />;
    if (page === "returns")   return <Returns />;
    if (page === "pl")        return isAdminRole(role) ? <ProfitLoss /> : <Dashboard />;
    if (page === "udhaar")    return <Udhaar />;
    if (page === "reports")   return isAdminRole(role) ? <Reports /> : <Dashboard />;
    if (page === "team")      return isAdminRole(role) ? <Team currentUsername={user} /> : <Dashboard />;
    if (page === "settings")  return isAdminRole(role) ? <Settings onUpdated={handleSettingsUpdated} /> : <Dashboard />;
    return <Dashboard />;
  };

  return (
    <div className="app-layout">
      {isMobile && <div className={"sidebar-overlay" + (mobileOpen ? " visible" : "")} onClick={() => setMobileOpen(false)} />}

      {showPwModal && (
        <div className="modal-overlay" onClick={() => setShowPwModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🔑 Change Password</h2>
            <label>Current Password</label>
            <input type="password" value={pwData.old_password} onChange={e => setPwData({...pwData, old_password: e.target.value})} placeholder="Enter current password" />
            <label>New Password</label>
            <input type="password" value={pwData.new_password} onChange={e => setPwData({...pwData, new_password: e.target.value})} placeholder="Enter new password" />
            {pwMsg && <div className={pwMsg.startsWith("✅") ? "pw-success" : "pw-error"}>{pwMsg}</div>}
            <div className="modal-actions">
              <button className="btn-primary" onClick={changePw}>Save Changes</button>
              <button className="btn-outline" onClick={() => { setShowPwModal(false); setPwData({ old_password: "", new_password: "" }); setPwMsg(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <aside className={sidebarCls}>
        <div className="sidebar-header">
          <div className="shop-icon">🏪</div>
          {(sideOpen || isMobile) && (
            <div className="shop-info">
              <div className="shop-name">{shop.shop_name}</div>
              <div className="shop-sub">{shop.shop_tagline}</div>
            </div>
          )}
          {!isMobile && <button className="toggle-btn" onClick={() => setSideOpen(!sideOpen)}>{sideOpen ? "◀" : "▶"}</button>}
          {isMobile  && <button className="toggle-btn" onClick={() => setMobileOpen(false)}>✕</button>}
        </div>

        <nav className="sidebar-nav">
          {visiblePages.map(p => (
            <button key={p.id} className={"nav-item" + (page === p.id ? " active" : "")} onClick={() => navigate(p.id)}>
              <span className="nav-icon">{p.icon}</span>
              {(sideOpen || isMobile) && <span className="nav-label">{p.label}</span>}
            </button>
          ))}
        </nav>

        {(sideOpen || isMobile) && (
          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">{user[0]?.toUpperCase()}</div>
              <div style={{ overflow: "hidden" }}>
                <span className="user-name" style={{ display: "block" }}>{fullName || user}</span>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {role === "owner" ? "👑 Owner" : role === "admin" ? "🛡️ Admin" : "👤 Staff"}
                </span>
              </div>
            </div>
            <div className="footer-actions">
              <button className="footer-btn" onClick={() => { setShowPwModal(true); if(isMobile) setMobileOpen(false); }} title="Change Password">🔑</button>
              <button className="footer-btn logout-btn" onClick={handleLogout} title="Logout">🚪</button>
            </div>
          </div>
        )}
        {!sideOpen && !isMobile && (
          <div style={{ padding:"12px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:"8px", borderTop:"1px solid var(--border)" }}>
            <button className="footer-btn" onClick={() => setShowPwModal(true)} title="Change Password">🔑</button>
            <button className="footer-btn logout-btn" onClick={handleLogout} title="Logout">🚪</button>
          </div>
        )}
      </aside>

      <main className="main-content">
        {isMobile && (
          <div className="mobile-topbar">
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>☰</button>
            <span className="mobile-topbar-title">🏪 {currentLabel}</span>
            <button className="mobile-logout-btn" onClick={handleLogout}>🚪</button>
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}
