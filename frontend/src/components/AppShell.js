import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { BellRing, CalendarDays, LayoutDashboard, Leaf, LogOut, Menu, MessageCircle, Settings, Users, WalletCards, X } from "../icons";
import { useAuth } from "./AuthProvider";

const links = [
  ["/", "Dashboard", LayoutDashboard],
  ["/clients", "Clients", Users],
  ["/batches", "Batches & plans", CalendarDays],
  ["/finances", "Finances", WalletCards],
  ["/reminders", "Reminders", MessageCircle],
  ["/settings", "Settings", Settings],
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const leave = async () => {
    await logout();
    navigate("/login");
  };
  return <div className="app-frame" data-testid="admin-app-shell">
    <button className="mobile-menu" data-testid="sidebar-menu-button" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    <aside className={`sidebar ${open ? "is-open" : ""}`} data-testid="primary-navigation">
      <div className="brand-mark" data-testid="studio-brand"><Leaf size={22} /><span>divine<span>yoga</span></span></div>
      <p className="sidebar-caption">Studio workspace</p>
      <nav>{links.map(([path, label, Icon]) => <NavLink key={path} to={path} end={path === "/"} data-testid={`nav-${label.toLowerCase().replaceAll(" ", "-").replace("&-", "")}`} onClick={() => setOpen(false)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
      <div className="side-foot"><div className="owner-avatar"><Leaf size={17} /></div><div><strong data-testid="admin-display-name">{user?.display_name || "Studio Admin"}</strong><small data-testid="admin-email">{user?.email}</small></div><button title="Sign out" aria-label="Sign out" data-testid="logout-button" onClick={leave}><LogOut size={17} /></button></div>
    </aside>
    <main className="main-panel">{children}</main>
  </div>;
}