import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import { statusToBadge } from "../../lib/badge";
import { Users, CheckCircle2, Clock, CalendarX, TrendingUp, LogIn, LogOut, Camera, X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  pendingLeaves: number;
  pendingRemote: number;
}

interface TodayAttendanceRow {
  employee_id: string;
  attendance_status: string | null;
  check_in: string | null;
  check_out: string | null;
  check_in_selfie: string | null;
  check_out_selfie: string | null;
  profiles: { full_name: string; employee_id: string; profile_image: string | null } | null;
}

interface RecentActivity {
  id: string;
  full_name: string;
  employee_id: string;
  profile_image: string | null;
  check_in: string | null;
  check_out: string | null;
  check_in_selfie: string | null;
  check_out_selfie: string | null;
  attendance_status: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ totalEmployees: 0, presentToday: 0, absentToday: 0, pendingLeaves: 0, pendingRemote: 0 });
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [weekData, setWeekData] = useState<{ day: string; present: number; absent: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfieView, setSelfieView] = useState<{ url: string; label: string } | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const companyId = user!.profile.company_id;

    const [empRes, attRes, leaveRes, remoteRes] = await Promise.all([
      supabase.from("profiles").select("id, user_roles!inner(name)", { count: "exact" }).eq("company_id", companyId).eq("status", "active").neq("user_roles.name", "super_admin"),
      supabase.from("attendance").select("employee_id, attendance_status, check_in, check_out, check_in_selfie, check_out_selfie, profiles!inner(full_name, employee_id, profile_image)").eq("attendance_date", today),
      supabase.from("leave_requests").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("attenote_work_requests").select("id", { count: "exact" }).eq("status", "pending"),
    ]);

    const totalEmployees = empRes.count ?? 0;
    const todayRecords = (attRes.data as TodayAttendanceRow[] | null) ?? [];
    const presentToday = todayRecords.filter((r) => r.attendance_status === "present" || r.attendance_status === "late_login").length;
    const absentToday = todayRecords.filter((r) => r.attendance_status === "absent").length;

    setStats({
      totalEmployees,
      presentToday,
      absentToday,
      pendingLeaves: leaveRes.count ?? 0,
      pendingRemote: remoteRes.count ?? 0,
    });

    // Recent check-ins, most recent first
    const recentFormatted: RecentActivity[] = todayRecords
      .slice()
      .sort((a, b) => (b.check_in ?? "").localeCompare(a.check_in ?? ""))
      .slice(0, 10)
      .map((r) => ({
        id: r.employee_id,
        full_name: r.profiles?.full_name ?? "—",
        employee_id: r.profiles?.employee_id ?? "—",
        profile_image: r.profiles?.profile_image ?? null,
        check_in: r.check_in,
        check_out: r.check_out,
        check_in_selfie: r.check_in_selfie,
        check_out_selfie: r.check_out_selfie,
        attendance_status: r.attendance_status ?? "unknown",
      }));
    setRecent(recentFormatted);

    // Last 7 days chart data
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });

    const { data: weekAtt } = await supabase
      .from("attendance")
      .select("attendance_date, attendance_status")
      .in("attendance_date", days);

    const chartData = days.map((d) => {
      const dayRecs = (weekAtt ?? []).filter((r) => r.attendance_date === d);
      return {
        day: new Date(d).toLocaleDateString("en-IN", { weekday: "short" }),
        present: dayRecs.filter((r) => r.attendance_status === "present" || r.attendance_status === "late_login").length,
        absent: dayRecs.filter((r) => r.attendance_status === "absent").length,
      };
    });
    setWeekData(chartData);
    setLoading(false);
  }, [user, today]);

  useEffect(() => {
    if (user) Promise.resolve().then(() => fetchDashboard());
  }, [user, fetchDashboard]);

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
        <StatCard label="Total Employees" value={stats.totalEmployees} icon={<Users size={18} />} color="indigo" />
        <StatCard label="Present Today" value={stats.presentToday} icon={<CheckCircle2 size={18} />} color="green" sub={`${stats.totalEmployees ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% attendance`} />
        <StatCard label="Pending Leaves" value={stats.pendingLeaves} icon={<CalendarX size={18} />} color="yellow" />
        <StatCard label="Remote Requests" value={stats.pendingRemote} icon={<Clock size={18} />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Attendance Trend */}
        <div className="lg:col-span-3 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" />
              Attendance Trend
            </h2>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" /> Present</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> Absent</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">Headcount present vs. absent across the last 7 days</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weekData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="absentFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
                cursor={{ stroke: "#475569", strokeDasharray: "3 3" }}
              />
              <Area type="monotone" dataKey="present" name="Present" stroke="#818cf8" strokeWidth={2.5} fill="url(#presentFill)" />
              <Area type="monotone" dataKey="absent" name="Absent" stroke="#f87171" strokeWidth={2.5} fill="url(#absentFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Today's check-ins */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-200">Today's Clock-ins</h2>
            <span className="text-xs text-gray-500">{recent.length} recorded</span>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No clock-ins recorded yet today.</p>
          ) : (
            <div className="space-y-2 max-h-105 overflow-y-auto pr-1 -mr-1">
              {recent.map((r) => {
                const selfie = r.check_in_selfie ?? r.check_out_selfie;
                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/employees/${r.id}?date=${today}`)}
                    className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    {/* Selfie / profile avatar */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selfie) setSelfieView({ url: selfie, label: `${r.full_name} — Clock-in selfie` });
                      }}
                      className="relative shrink-0"
                    >
                      {selfie ? (
                        <img src={selfie} alt={r.full_name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                      ) : r.profile_image ? (
                        <img src={r.profile_image} alt={r.full_name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-500/30 to-blue-500/30 flex items-center justify-center text-sm font-semibold text-indigo-300 uppercase border border-white/10">
                          {r.full_name.charAt(0)}
                        </div>
                      )}
                      {selfie && (
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 border-2 border-gray-950 flex items-center justify-center">
                          <Camera size={10} className="text-white" />
                        </span>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{r.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{r.employee_id}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-2.5 mt-0.5">
                        <span className="flex items-center gap-1"><LogIn size={11} /> {fmt(r.check_in)}</span>
                        {r.check_out && <span className="flex items-center gap-1"><LogOut size={11} /> {fmt(r.check_out)}</span>}
                      </p>
                    </div>

                    <Badge variant={statusToBadge(r.attendance_status)}>
                      {r.attendance_status?.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selfie lightbox */}
      {selfieView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelfieView(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative max-w-md w-full">
            <button onClick={() => setSelfieView(null)} className="absolute -top-10 right-0 text-gray-300 hover:text-white">
              <X size={22} />
            </button>
            <img src={selfieView.url} alt={selfieView.label} className="w-full rounded-2xl border border-white/10" />
            <p className="text-center text-sm text-gray-300 mt-3">{selfieView.label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
