import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import WebSelfieCheckInModal from "../../components/modals/WebSelfieCheckInModal";
import Badge from "../../components/ui/Badge";
import { statusToBadge } from "../../lib/badge";
import { Camera, LogIn, CheckCircle2 } from "lucide-react";
import type { AttendanceRecord } from "../../types";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function EmployeeHomePage() {
  const { user } = useAuth();
  const profile = user?.profile;
  const [showModal, setShowModal] = useState(false);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [recent, setRecent] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [todayRes, recentRes] = await Promise.all([
      supabase.from("attendance").select("*").eq("employee_id", profile.id).eq("attendance_date", todayStr).maybeSingle(),
      supabase.from("attendance").select("*").eq("employee_id", profile.id)
        .gte("attendance_date", sevenDaysAgo.toISOString().split("T")[0])
        .lte("attendance_date", todayStr)
        .order("attendance_date", { ascending: false }),
    ]);
    setToday((todayRes.data as AttendanceRecord) ?? null);
    setRecent((recentRes.data as AttendanceRecord[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    Promise.resolve().then(() => fetchAll());
  }, [fetchAll]);

  const monthStats = (() => {
    const present = recent.filter((r) => r.attendance_status === "present" || r.attendance_status === "late_login").length;
    const absent = recent.filter((r) => r.attendance_status === "absent").length;
    const halfDay = recent.filter((r) => r.attendance_status === "half_day").length;
    const rate = recent.length ? Math.round((present / recent.length) * 100) : 0;
    return { present, absent, halfDay, rate };
  })();

  const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  const status = !today ? "not_checked_in" : !today.check_out ? "checked_in" : "completed";

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-400">{greeting()},</p>
        <h1 className="text-2xl font-bold text-gray-100">{profile?.full_name}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{profile?.employee_id} · {profile?.departments?.name ?? "—"}</p>
      </div>

      {/* Status banner */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {status === "not_checked_in" && <LogIn size={18} className="text-yellow-400" />}
            {status === "checked_in" && <CheckCircle2 size={18} className="text-green-400" />}
            {status === "completed" && <CheckCircle2 size={18} className="text-indigo-400" />}
            <span className="font-semibold text-gray-100">
              {status === "not_checked_in" ? "Not Clocked In" : status === "checked_in" ? "Currently Working" : "Attendance Complete"}
            </span>
          </div>
          {today?.attendance_status && <Badge variant={statusToBadge(today.attendance_status)}>{today.attendance_status.replace("_", " ")}</Badge>}
        </div>

        {today && (
          <div className="flex items-center gap-6 text-sm mb-4">
            <div>
              <p className="text-xs text-gray-500">Clock-In</p>
              <p className="font-medium text-gray-200">{fmtTime(today.check_in)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Clock-Out</p>
              <p className="font-medium text-gray-200">{fmtTime(today.check_out)}</p>
            </div>
            {today.total_hours != null && (
              <div>
                <p className="text-xs text-gray-500">Hours</p>
                <p className="font-medium text-gray-200">{today.total_hours}h</p>
              </div>
            )}
          </div>
        )}

        {status !== "completed" && (
          <button
            onClick={() => setShowModal(true)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors ${
              status === "checked_in" ? "bg-red-600 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            <Camera size={16} />
            {status === "checked_in" ? "Clock Out" : "Clock In"}
          </button>
        )}
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Present", value: monthStats.present, color: "text-green-400" },
          { label: "Absent", value: monthStats.absent, color: "text-red-400" },
          { label: "Half Day", value: monthStats.halfDay, color: "text-purple-400" },
          { label: "Rate", value: `${monthStats.rate}%`, color: "text-indigo-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Last 7 days */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Last 7 Days</h2>
      <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No attendance records yet.</p>
        ) : (
          recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-200">{fmtDate(r.attendance_date)}</p>
                <p className="text-xs text-gray-500">{fmtTime(r.check_in)} → {fmtTime(r.check_out)}</p>
              </div>
              <Badge variant={statusToBadge(r.attendance_status ?? "")}>{r.attendance_status?.replace("_", " ") ?? "—"}</Badge>
            </div>
          ))
        )}
      </div>

      <WebSelfieCheckInModal visible={showModal} onClose={() => setShowModal(false)} onSuccess={() => fetchAll()} />
    </div>
  );
}
