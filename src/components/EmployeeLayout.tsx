import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Home, History, Calendar, Megaphone, User, Bell } from "lucide-react";
import logo from "../assets/logo.png";

// Mirrors the mobile app's EmployeeTabs.tsx (Home / History / Calendar /
// Announcements / Profile) — Settings folds into Profile on web since the
// mobile "Settings" tab is mostly app prefs/help that don't apply here.
const TABS = [
  { to: "/",          icon: Home,      label: "Home" },
  { to: "/history",   icon: History,   label: "History" },
  { to: "/calendar",  icon: Calendar,  label: "Calendar" },
  { to: "/broadcasts", icon: Megaphone, label: "Updates" },
  { to: "/profile",   icon: User,      label: "Profile" },
];

const TITLES: Record<string, string> = {
  "/": "Home",
  "/history": "Attendance History",
  "/calendar": "Calendar",
  "/broadcasts": "Announcements",
  "/profile": "Profile",
  "/notifications": "Notifications",
};

export default function EmployeeLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const title =
    TITLES[location.pathname] ??
    (location.pathname.startsWith("/broadcasts/") ? "Announcement" : "FUD Plus");

  return (
    <div className="app-gradient-bg flex flex-col h-screen text-gray-100 overflow-hidden">
      {/* Topbar */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/8 glass-card border-t-0 border-x-0 rounded-none shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logo} alt="FUD Plus" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-100 truncate">{title}</h1>
            <p className="hidden sm:block text-xs text-gray-500">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NavLink to="/notifications" className="p-2 text-gray-400 hover:text-gray-100 hover:bg-white/5 rounded-lg transition-colors relative">
            <Bell size={18} />
          </NavLink>
          <div className="hidden sm:block w-px h-6 bg-white/8" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-xs font-semibold uppercase shrink-0">
              {user?.profile.full_name?.charAt(0) ?? "E"}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium leading-none">{user?.profile.full_name}</p>
              <p className="text-[11px] text-gray-500 capitalize">{user?.role?.replace("_", " ")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <Outlet />
      </main>

      {/* Floating bottom tab bar — matches the mobile app's EmployeeTabs */}
      <nav className="fixed bottom-4 left-4 right-4 z-40 h-17 rounded-[26px] border border-white/10 bg-white/8 backdrop-blur-xl shadow-2xl shadow-black/40 flex items-center justify-around px-2 max-w-md mx-auto">
        {TABS.map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
          >
            {({ isActive }) => (
              <div
                className={`w-11 h-11 rounded-[18px] flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-indigo-400/25 border border-white/15 shadow-lg shadow-indigo-900/40"
                    : ""
                }`}
              >
                <Icon size={20} className={isActive ? "text-white" : "text-indigo-100/70"} />
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
