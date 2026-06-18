import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import Badge, { statusToBadge } from "../../components/ui/Badge";
import {
  ArrowLeft, Mail, Phone, Calendar, CreditCard, Clock,
  CheckCircle2, XCircle, Pencil, Trash2, Image as ImageIcon, X, CalendarCheck,
} from "lucide-react";
import type { Profile, AttendanceRecord } from "../../types";

const DEPT_COLORS: Record<string, string> = {
  Engineering: "#2563eb", Finance: "#059669", Marketing: "#7c3aed",
  HR: "#db2777", Operations: "#d97706", Design: "#0891b2", Sales: "#dc2626",
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusDate = searchParams.get("date");
  const [employee, setEmployee] = useState<Profile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfieView, setSelfieView] = useState<{ url: string; label: string } | null>(null);

  async function fetchAll() {
    setLoading(true);
    const [empRes, attRes] = await Promise.all([
      supabase.from("profiles").select("*, departments(id, name), user_roles(id, name)").eq("id", id).single(),
      supabase.from("attendance").select("*").eq("employee_id", id).order("attendance_date", { ascending: false }).limit(60),
    ]);
    setEmployee(empRes.data as Profile);
    setAttendance((attRes.data as AttendanceRecord[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { if (id) fetchAll(); }, [id]);

  async function deleteEmployee() {
    if (!employee) return;
    if (!confirm(`Permanently delete ${employee.full_name} and all their data?`)) return;
    await supabase.rpc("purge_employee_cascade", { target_profile_id: employee.id });
    navigate("/employees");
  }

  const stats = useMemo(() => {
    const present = attendance.filter((r) => r.attendance_status === "present" || r.attendance_status === "late_login").length;
    const late = attendance.filter((r) => r.attendance_status === "late_login").length;
    const absent = attendance.filter((r) => r.attendance_status === "absent").length;
    const halfDay = attendance.filter((r) => r.attendance_status === "half_day").length;
    const rate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
    return { present, late, absent, halfDay, rate };
  }, [attendance]);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

  const displayedAttendance = useMemo(
    () => (focusDate ? attendance.filter((r) => r.attendance_date === focusDate) : attendance),
    [attendance, focusDate],
  );
  const clearDateFilter = () => setSearchParams({}, { replace: true });

  if (loading || !employee) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  const deptName = employee.departments?.name ?? "—";
  const deptColor = DEPT_COLORS[deptName] ?? "#3b82f6";
  const initials = employee.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <button onClick={() => navigate("/employees")} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-100 mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Employees
      </button>

      {/* Hero */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-6">
        {employee.profile_image ? (
          <img src={employee.profile_image} alt={employee.full_name} className="w-24 h-24 rounded-2xl object-cover border border-white/10 shadow-lg" />
        ) : (
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${deptColor}, ${deptColor}99)` }}>
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-100">{employee.full_name}</h1>
            <Badge variant={statusToBadge(employee.status)}>{employee.status}</Badge>
          </div>
          <p className="text-sm font-medium mb-3" style={{ color: deptColor }}>{deptName} · {employee.user_roles?.name ?? "employee"}</p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><Mail size={14} /> {employee.email}</span>
            <span className="flex items-center gap-1.5"><Phone size={14} /> {employee.phone || "—"}</span>
            <span className="flex items-center gap-1.5"><CreditCard size={14} /> {employee.employee_id}</span>
            <span className="flex items-center gap-1.5"><Calendar size={14} /> Joined {fmtDate(employee.joining_date)}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button onClick={() => navigate(`/employees?edit=${employee.id}`)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Pencil size={14} /> Edit
          </button>
          <button onClick={deleteEmployee} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-colors">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Attendance Rate", value: `${stats.rate}%`, icon: <Clock size={16} />, color: "indigo" },
          { label: "Present", value: stats.present, icon: <CheckCircle2 size={16} />, color: "green" },
          { label: "Late", value: stats.late, icon: <Clock size={16} />, color: "yellow" },
          { label: "Half Day", value: stats.halfDay, icon: <Clock size={16} />, color: "purple" },
          { label: "Absent", value: stats.absent, icon: <XCircle size={16} />, color: "red" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</span>
              <span className="text-gray-400">{s.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Attendance history */}
      {focusDate && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <p className="text-sm text-indigo-300 flex items-center gap-2">
            <CalendarCheck size={15} />
            Showing attendance for {fmtDate(focusDate)} only
          </p>
          <button onClick={clearDateFilter} className="text-xs font-medium text-indigo-300 hover:text-indigo-200 underline">
            View full history
          </button>
        </div>
      )}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-gray-100">Attendance History</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {focusDate ? `${displayedAttendance.length} record(s) for this date` : `Last ${attendance.length} records, with check-in/out selfies`}
          </p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Check-In</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Check-Out</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Hours</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Selfies</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {displayedAttendance.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-800/50 transition-colors ${r.attendance_date === focusDate ? "bg-indigo-500/5" : ""}`}>
                <td className="px-6 py-3 text-gray-300">{fmtDate(r.attendance_date)}</td>
                <td className="px-6 py-3 text-gray-400 font-mono text-xs">{fmtTime(r.check_in)}</td>
                <td className="px-6 py-3 text-gray-400 font-mono text-xs">{fmtTime(r.check_out)}</td>
                <td className="px-6 py-3 text-gray-400">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                <td className="px-6 py-3"><Badge variant={statusToBadge(r.attendance_status ?? "")}>{r.attendance_status?.replace("_", " ") ?? "—"}</Badge></td>
                <td className="px-6 py-3">
                  <div className="flex gap-2">
                    {r.check_in_selfie ? (
                      <button onClick={() => setSelfieView({ url: r.check_in_selfie!, label: "Check-In Selfie" })}>
                        <img src={r.check_in_selfie} alt="check-in" className="w-8 h-8 rounded-lg object-cover border border-gray-700 hover:border-indigo-500 transition-colors" />
                      </button>
                    ) : <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center"><ImageIcon size={12} className="text-gray-400" /></span>}
                    {r.check_out_selfie ? (
                      <button onClick={() => setSelfieView({ url: r.check_out_selfie!, label: "Check-Out Selfie" })}>
                        <img src={r.check_out_selfie} alt="check-out" className="w-8 h-8 rounded-lg object-cover border border-gray-700 hover:border-indigo-500 transition-colors" />
                      </button>
                    ) : <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center"><ImageIcon size={12} className="text-gray-400" /></span>}
                  </div>
                </td>
              </tr>
            ))}
            {displayedAttendance.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                {focusDate ? "No attendance record for this date." : "No attendance records yet."}
              </td></tr>
            )}
          </tbody>
        </table>
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
