import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  LayoutDashboard, Users, Calendar, Clock, Briefcase,
  Megaphone, FileBarChart2, Settings, LogOut, Sun,
  Building2, Bell,
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

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const currentPage = ALL_NAV_ITEMS.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
  );

  return (
    <div className="app-gradient-bg flex h-screen text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col glass-card border-r border-y-0 border-l-0 shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="FUD Plus" className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-indigo-900/40" />
            <div>
              <span className="font-semibold text-lg tracking-tight leading-none block">FUD Plus</span>
              <span className="text-[11px] text-gray-500">HRMS Admin Panel</span>
            </div>
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-white/8 glass-card border-t-0 border-x-0 rounded-none shrink-0">
          <div>
            <h1 className="text-lg font-bold text-gray-100">{currentPage?.label ?? "FUD Plus"}</h1>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-400 hover:text-gray-100 hover:bg-white/5 rounded-lg transition-colors relative">
              <Bell size={18} />
            </button>
            <div className="w-px h-6 bg-white/8" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-xs font-semibold uppercase">
                {user?.profile.full_name?.charAt(0) ?? "A"}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium leading-none">{user?.profile.full_name}</p>
                <p className="text-[11px] text-gray-500 capitalize">{user?.role?.replace("_", " ")}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
