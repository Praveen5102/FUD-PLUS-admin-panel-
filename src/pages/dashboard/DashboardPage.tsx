import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import { statusToBadge } from "../../lib/badge";
import { Users, CheckCircle2, Clock, CalendarX, TrendingUp, LogIn, LogOut } from "lucide-react";
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
  profiles: { full_name: string; employee_id: string } | null;
}

interface RecentActivity {
  id: string;
  full_name: string;
  employee_id: string;
  check_in: string | null;
  check_out: string | null;
  attendance_status: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ totalEmployees: 0, presentToday: 0, absentToday: 0, pendingLeaves: 0, pendingRemote: 0 });
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [weekData, setWeekData] = useState<{ day: string; present: number; absent: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const companyId = user!.profile.company_id;

    const [empRes, attRes, leaveRes, remoteRes] = await Promise.all([
      supabase.from("profiles").select("id, user_roles!inner(name)", { count: "exact" }).eq("company_id", companyId).eq("status", "active").neq("user_roles.name", "super_admin"),
      supabase.from("attendance").select("employee_id, attendance_status, check_in, check_out, profiles!inner(full_name, employee_id)").eq("attendance_date", today),
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

    // Recent check-ins
    const recentFormatted: RecentActivity[] = todayRecords.slice(0, 10).map((r) => ({
      id: r.employee_id,
      full_name: r.profiles?.full_name ?? "—",
      employee_id: r.profiles?.employee_id ?? "—",
      check_in: r.check_in,
      check_out: r.check_out,
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
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Today's Check-ins</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No check-ins recorded yet today.</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {recent.map((r) => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/employees/${r.id}?date=${today}`)}
                  className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500/30 to-blue-500/30 flex items-center justify-center text-xs font-semibold text-indigo-300 uppercase shrink-0">
                    {r.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{r.full_name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="flex items-center gap-1"><LogIn size={11} /> {fmt(r.check_in)}</span>
                      {r.check_out && <span className="flex items-center gap-1"><LogOut size={11} /> {fmt(r.check_out)}</span>}
                    </p>
                  </div>
                  <Badge variant={statusToBadge(r.attendance_status)}>
                    {r.attendance_status?.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
