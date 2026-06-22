import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  LayoutDashboard, Users, Calendar, Clock, Briefcase,
  Megaphone, FileBarChart2, Settings, LogOut, Sun,
  Building2, Bell, Grid3x3, X,
} from "lucide-react";
import logo from "../assets/logo.png";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "People",
    items: [
      { to: "/employees",   icon: Users,      label: "Employees" },
      { to: "/attendance",  icon: Clock,      label: "Attendance" },
      { to: "/leaves",      icon: Calendar,   label: "Leave Requests" },
      { to: "/remote",      icon: Briefcase,  label: "Remote Requests" },
      { to: "/departments", icon: Building2,  label: "Departments" },
    ],
  },
  {
    label: "Engage",
    items: [
      { to: "/broadcasts", icon: Megaphone, label: "Broadcasts" },
      { to: "/holidays",   icon: Sun,       label: "Holidays" },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/reports",  icon: FileBarChart2, label: "Reports" },
      { to: "/settings", icon: Settings,      label: "Settings" },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// The mobile app's bottom tab bar (AdminTabs.tsx) shows exactly these 6 —
// Dashboard / Employees / Calendar / Announcements / Reports / Settings.
// The web panel has more pages than fit a 5-icon bottom bar, so the 4 most
// used get a direct slot and everything else (including the calendar-ish
// pages the mobile app merges into one "Calendar" tab) lives behind "More".
const BOTTOM_TABS = [
  { to: "/",            icon: LayoutDashboard, label: "Dashboard" },
  { to: "/employees",   icon: Users,           label: "Employees" },
  { to: "/leaves",      icon: Calendar,        label: "Calendar" },
  { to: "/broadcasts",  icon: Megaphone,       label: "Updates" },
];
const MORE_ITEMS = ALL_NAV_ITEMS.filter(
  (item) => !BOTTOM_TABS.some((t) => t.to === item.to),
);

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(location.pathname);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const currentPage = ALL_NAV_ITEMS.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
  );
  const isMoreActive = MORE_ITEMS.some((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
  );

  // Close the mobile "More" sheet whenever the route changes.
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setMoreOpen(false);
  }

  return (
    <div className="app-gradient-bg flex h-screen text-gray-100 overflow-hidden">
      {/* Sidebar: desktop only — mobile uses the floating bottom tab bar instead */}
      <aside className="hidden lg:flex lg:static w-64 flex-col glass-card border-r border-y-0 border-l-0 shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/8 flex items-center gap-2.5">
          <img src={logo} alt="FUD Plus" className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-indigo-900/40" />
          <div>
            <span className="font-semibold text-lg tracking-tight leading-none block">FUD Plus</span>
            <span className="text-[11px] text-gray-500">HRMS Admin Panel</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-linear-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-900/30"
                          : "text-gray-400 hover:bg-white/5 hover:text-gray-100"
                      }`
                    }
                  >
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User profile bottom */}
        <div className="px-4 py-4 border-t border-white/8">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-xs font-semibold uppercase">
                {user?.profile.full_name?.charAt(0) ?? "A"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-gray-950" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.profile.full_name}</p>
              <p className="text-xs text-gray-400 truncate capitalize">{user?.role?.replace("_", " ")}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-white/8 glass-card border-t-0 border-x-0 rounded-none shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt="FUD Plus" className="w-8 h-8 rounded-lg object-cover shrink-0 lg:hidden" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-100 truncate">{currentPage?.label ?? "FUD Plus"}</h1>
              <p className="hidden sm:block text-xs text-gray-500">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button className="p-2 text-gray-400 hover:text-gray-100 hover:bg-white/5 rounded-lg transition-colors relative">
              <Bell size={18} />
            </button>
            <div className="hidden sm:block w-px h-6 bg-white/8" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-xs font-semibold uppercase shrink-0">
                {user?.profile.full_name?.charAt(0) ?? "A"}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium leading-none">{user?.profile.full_name}</p>
                <p className="text-[11px] text-gray-500 capitalize">{user?.role?.replace("_", " ")}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ─────────────────────────────────────────
          Mirrors the mobile app's AdminTabs/HrTabs: a floating, blurred,
          rounded bar pinned near the bottom of the screen with 52px-style
          icon pills that light up when active. Hidden at lg+ where the
          sidebar takes over. */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-40 h-17 rounded-[26px] border border-white/10 bg-white/8 backdrop-blur-xl shadow-2xl shadow-black/40 flex items-center justify-around px-2">
        {BOTTOM_TABS.map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-11 h-11 rounded-[18px] flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-indigo-400/25 border border-white/15 shadow-lg shadow-indigo-900/40"
                      : ""
                  }`}
                >
                  <Icon size={20} className={isActive ? "text-white" : "text-indigo-100/70"} />
                </div>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
        >
          <div
            className={`w-11 h-11 rounded-[18px] flex items-center justify-center transition-colors ${
              isMoreActive || moreOpen
                ? "bg-indigo-400/25 border border-white/15 shadow-lg shadow-indigo-900/40"
                : ""
            }`}
          >
            <Grid3x3 size={20} className={isMoreActive || moreOpen ? "text-white" : "text-indigo-100/70"} />
          </div>
        </button>
      </nav>

      {/* ── MOBILE "MORE" SHEET ───────────────────────────────────────────
          Bottom-sheet, matching the mobile app's modal bottom-sheets:
          dark rounded-top panel sliding up from the bottom. */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="relative bg-gray-950 border-t border-white/10 rounded-t-4xl px-5 pt-3 pb-8 max-h-[75vh] overflow-y-auto">
            <div className="w-10 h-1.5 rounded-full bg-white/15 mx-auto mb-5" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-100">More</h2>
              <button onClick={() => setMoreOpen(false)} className="text-gray-400 hover:text-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {MORE_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-2 py-4 rounded-2xl border text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-500/15 border-indigo-400/30 text-white"
                        : "bg-white/5 border-white/8 text-gray-400"
                    }`
                  }
                >
                  <Icon size={20} />
                  {label}
                </NavLink>
              ))}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full px-3 py-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
