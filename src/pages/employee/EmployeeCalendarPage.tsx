import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import Badge from "../../components/ui/Badge";
import { statusToBadge } from "../../lib/badge";
import { Plus, Sun, X } from "lucide-react";
import type { Holiday, LeaveRequest, LeaveType } from "../../types";

interface LeaveBalanceRow { leave_type_id: string; leave_type_name: string; days_allowed: number; days_used: number; days_remaining: number; }

export default function EmployeeCalendarPage() {
  const { user } = useAuth();
  const profile = user?.profile;
  const [tab, setTab] = useState<"leaves" | "holidays">("leaves");

  const [balance, setBalance] = useState<LeaveBalanceRow[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const [showApply, setShowApply] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [balRes, reqRes, ltRes, holRes] = await Promise.all([
      supabase.rpc("get_leave_balance", { p_employee_id: profile.id }),
      supabase.from("leave_requests").select("*, leave_types(name, code)").eq("employee_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("leave_types").select("*").eq("company_id", profile.company_id).eq("is_active", true).order("name"),
      supabase.from("holidays").select("*").eq("company_id", profile.company_id).eq("is_active", true).gte("holiday_date", today).order("holiday_date").limit(10),
    ]);
    setBalance((balRes.data as LeaveBalanceRow[]) ?? []);
    setRequests((reqRes.data as LeaveRequest[]) ?? []);
    setLeaveTypes((ltRes.data as LeaveType[]) ?? []);
    setHolidays((holRes.data as Holiday[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    Promise.resolve().then(() => fetchAll());
  }, [fetchAll]);

  const todayStr = new Date().toISOString().split("T")[0];
  const daysBetween = (from: string, to: string) =>
    Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24) + 1));
  const totalDays = fromDate && toDate ? daysBetween(fromDate, toDate) : 0;

  async function submitLeave() {
    if (!profile || !leaveTypeId || !fromDate || !toDate || !reason.trim()) { alert("Please fill all fields."); return; }
    if (fromDate < todayStr) { alert("From date can't be in the past."); return; }
    if (new Date(toDate) < new Date(fromDate)) { alert("To date must be on or after from date."); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: profile.id,
        leave_type_id: leaveTypeId,
        from_date: fromDate,
        to_date: toDate,
        total_days: totalDays,
        reason: reason.trim(),
        status: "pending",
      });
      if (error) throw error;
      setShowApply(false);
      setLeaveTypeId(""); setFromDate(""); setToDate(""); setReason("");
      fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex gap-2 mb-6">
        {(["leaves", "holidays"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${tab === t ? "bg-indigo-600 text-white" : "bg-white/5 text-gray-400 hover:text-gray-100"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "leaves" && (
        <>
          {/* Balance cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {balance.map((b) => (
              <div key={b.leave_type_id} className="glass-card rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gray-100">{b.days_remaining}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{b.leave_type_name}</p>
                <p className="text-[10px] text-gray-600">of {b.days_allowed}</p>
              </div>
            ))}
            {balance.length === 0 && <p className="col-span-3 text-sm text-gray-500 text-center py-4">No leave types configured.</p>}
          </div>

          <button onClick={() => setShowApply(true)} className="w-full flex items-center justify-center gap-2 py-3 mb-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors">
            <Plus size={16} /> Apply for Leave
          </button>

          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Leave History</h2>
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
            {requests.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No leave requests yet.</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-200">{r.leave_types?.name ?? "Leave"}</span>
                    <Badge variant={statusToBadge(r.status)}>{r.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{fmtDate(r.from_date)} → {fmtDate(r.to_date)} · {r.total_days}d</p>
                  {r.reason && <p className="text-xs text-gray-400 mt-1">{r.reason}</p>}
                  {r.admin_note && <p className="text-xs text-yellow-400 mt-1">Note: {r.admin_note}</p>}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === "holidays" && (
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
          {holidays.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Sun size={28} className="mx-auto mb-2 opacity-30" />
              No upcoming holidays.
            </div>
          ) : (
            holidays.map((h) => (
              <div key={h.id} className="flex items-center gap-4 px-4 py-3">
                <div className="text-center w-10 shrink-0">
                  <p className="text-lg font-bold text-gray-100">{new Date(h.holiday_date).getDate()}</p>
                  <p className="text-[10px] text-gray-500">{new Date(h.holiday_date).toLocaleDateString("en-IN", { month: "short" })}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{h.title}</p>
                  {h.description && <p className="text-xs text-gray-500 truncate">{h.description}</p>}
                </div>
                <Badge variant="info">{h.holiday_type}</Badge>
              </div>
            ))
          )}
        </div>
      )}

      {/* Apply for leave sheet */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowApply(false)} />
          <div className="relative w-full max-w-sm glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-100">Apply for Leave</h2>
              <button onClick={() => setShowApply(false)} className="text-gray-400 hover:text-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Leave Type</label>
                <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
                  <option value="">Select…</option>
                  {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">From</label>
                  <input type="date" value={fromDate} min={todayStr}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      if (toDate && toDate < e.target.value) setToDate(e.target.value);
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">To</label>
                  <input type="date" value={toDate} min={fromDate || todayStr}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              {totalDays > 0 && <p className="text-xs text-indigo-400 text-center">{totalDays} day{totalDays > 1 ? "s" : ""} selected</p>}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Reason</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                  placeholder="Briefly describe the reason…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
            </div>
            <button onClick={submitLeave} disabled={submitting}
              className="w-full mt-5 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Submit Leave Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
