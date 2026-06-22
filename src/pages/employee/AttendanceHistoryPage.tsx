import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import Badge from "../../components/ui/Badge";
import { statusToBadge } from "../../lib/badge";
import { ImageIcon, X } from "lucide-react";
import type { AttendanceRecord } from "../../types";

export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  const profile = user?.profile;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [selfieView, setSelfieView] = useState<{ url: string; label: string } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", profile.id)
      .gte("attendance_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("attendance_date", { ascending: false });
    const rows = (data as AttendanceRecord[]) ?? [];
    setRecords(rows);
    setSelected(rows[0] ?? null);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    Promise.resolve().then(() => fetchAll());
  }, [fetchAll]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

  const summary = {
    present: records.filter((r) => r.attendance_status === "present" || r.attendance_status === "late_login").length,
    absent: records.filter((r) => r.attendance_status === "absent").length,
    halfDay: records.filter((r) => r.attendance_status === "half_day").length,
    rate: records.length ? Math.round((records.filter((r) => r.attendance_status === "present" || r.attendance_status === "late_login").length / records.length) * 100) : 0,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Selected day detail */}
      {selected && (
        <div className="glass-card rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-100">{fmtDate(selected.attendance_date)}</h2>
            <Badge variant={statusToBadge(selected.attendance_status ?? "")}>{selected.attendance_status?.replace("_", " ") ?? "—"}</Badge>
          </div>
          <div className="flex items-center gap-6 text-sm mb-4">
            <div><p className="text-xs text-gray-500">Clock-In</p><p className="font-medium text-gray-200">{fmtTime(selected.check_in)}</p></div>
            <div><p className="text-xs text-gray-500">Clock-Out</p><p className="font-medium text-gray-200">{fmtTime(selected.check_out)}</p></div>
            <div><p className="text-xs text-gray-500">Hours</p><p className="font-medium text-gray-200">{selected.total_hours ? `${selected.total_hours}h` : "—"}</p></div>
          </div>
          <div className="flex gap-3">
            {selected.check_in_selfie ? (
              <button onClick={() => setSelfieView({ url: selected.check_in_selfie!, label: "Clock-In Selfie" })}>
                <img src={selected.check_in_selfie} alt="clock-in" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
              </button>
            ) : <span className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center"><ImageIcon size={16} className="text-gray-500" /></span>}
            {selected.check_out_selfie ? (
              <button onClick={() => setSelfieView({ url: selected.check_out_selfie!, label: "Clock-Out Selfie" })}>
                <img src={selected.check_out_selfie} alt="clock-out" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
              </button>
            ) : <span className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center"><ImageIcon size={16} className="text-gray-500" /></span>}
          </div>
        </div>
      )}

      {/* 30-day summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Present", value: summary.present, color: "text-green-400" },
          { label: "Absent", value: summary.absent, color: "text-red-400" },
          { label: "Half Day", value: summary.halfDay, color: "text-purple-400" },
          { label: "Rate", value: `${summary.rate}%`, color: "text-indigo-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Last 30 Days</h2>
      <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
        {records.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No attendance records yet.</p>
        ) : (
          records.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${selected?.id === r.id ? "bg-indigo-500/10" : "hover:bg-white/5"}`}
            >
              <div>
                <p className="text-sm font-medium text-gray-200">{new Date(r.attendance_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
                <p className="text-xs text-gray-500">{fmtTime(r.check_in)} → {fmtTime(r.check_out)}</p>
              </div>
              <Badge variant={statusToBadge(r.attendance_status ?? "")}>{r.attendance_status?.replace("_", " ") ?? "—"}</Badge>
            </button>
          ))
        )}
      </div>

      {selfieView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelfieView(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative max-w-md w-full">
            <button onClick={() => setSelfieView(null)} className="absolute -top-10 right-0 text-gray-300 hover:text-white"><X size={22} /></button>
            <img src={selfieView.url} alt={selfieView.label} className="w-full rounded-2xl border border-white/10" />
            <p className="text-center text-sm text-gray-300 mt-3">{selfieView.label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
