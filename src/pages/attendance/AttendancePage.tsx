import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Badge, { statusToBadge } from "../../components/ui/Badge";
import { RefreshCw } from "lucide-react";
import type { AttendanceRecord } from "../../types";

export default function AttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { if (user) fetchAttendance(); }, [user]);

  async function fetchAttendance() {
    setLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("*, profiles!employee_id(full_name, employee_id, departments(name))")
      .gte("attendance_date", dateFrom)
      .lte("attendance_date", dateTo)
      .order("attendance_date", { ascending: false })
      .order("check_in", { ascending: false });
    setRecords((data as AttendanceRecord[]) ?? []);
    setLoading(false);
  }

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-500 mt-1">{records.length} records</p>
        </div>
        <button onClick={fetchAttendance} className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
        </div>
        <button onClick={fetchAttendance}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
          Apply
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Check-In</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Check-Out</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Hours</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {records.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/employees/${r.employee_id}?date=${r.attendance_date}`)}
                  className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-100">{(r.profiles as any)?.full_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{(r.profiles as any)?.employee_id} · {(r.profiles as any)?.departments?.name ?? "—"}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{new Date(r.attendance_date).toLocaleDateString("en-IN")}</td>
                  <td className="px-6 py-4 text-gray-300 font-mono text-xs">{fmt(r.check_in)}</td>
                  <td className="px-6 py-4 text-gray-300 font-mono text-xs">{fmt(r.check_out)}</td>
                  <td className="px-6 py-4 text-gray-400">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                  <td className="px-6 py-4">
                    {r.attendance_mode && (
                      <span className="text-xs text-gray-400 capitalize">{r.attendance_mode?.replace("_", " ")}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusToBadge(r.attendance_status ?? "") as any}>
                      {r.attendance_status?.replace("_", " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No attendance records for selected date range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
