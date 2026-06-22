import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Badge from "../../components/ui/Badge";
import { statusToBadge } from "../../lib/badge";
import Modal from "../../components/ui/Modal";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import type { RemoteRequest } from "../../types";

type FilterStatus = "all" | "pending" | "approved" | "rejected";

const typeLabel: Record<string, string> = {
  remote_work: "Remote Work",
  client_visit: "Client Visit",
  business_trip: "Business Trip",
  other: "Other",
};

export default function RemotePage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RemoteRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{ request: RemoteRequest; action: "approved" | "rejected" } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("attenote_work_requests")
      .select("*, profiles!employee_id(full_name, employee_id, departments(name))")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRequests((data as RemoteRequest[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (user) Promise.resolve().then(() => fetchRequests());
  }, [user, filter, fetchRequests]);

  async function processAction() {
    if (!actionModal) return;
    setProcessing(true);
    const req = actionModal.request;

    try {
      const { error: updateErr } = await supabase.from("attenote_work_requests").update({
        status: actionModal.action,
        approved_by: user!.profile.id,
        approved_at: new Date().toISOString(),
        admin_note: adminNote || null,
      }).eq("id", req.id);
      if (updateErr) throw updateErr;

      // Instant check-in request approved → create today's attendance row as
      // remote, starting from when the employee actually raised the request
      // (not whenever the admin happens to approve it).
      if (actionModal.action === "approved" && req.is_attendance_request) {
        const location = (req.request_latitude != null && req.request_longitude != null)
          ? `POINT(${req.request_longitude} ${req.request_latitude})`
          : null;
        const { error: attErr } = await supabase.from("attendance").upsert({
          employee_id: req.employee_id,
          attendance_date: req.from_date,
          check_in: req.created_at,
          check_in_selfie: req.selfie_url ?? null,
          check_in_location: location,
          attendance_status: "present",
          attendance_mode: "remote",
        }, { onConflict: "employee_id,attendance_date", ignoreDuplicates: true });
        if (attErr) throw attErr;
      }

      await supabase.functions.invoke("send-notification", {
        body: {
          profile_id: req.employee_id,
          title: `Remote Request ${actionModal.action === "approved" ? "Approved" : "Rejected"}`,
          message: req.is_attendance_request
            ? `Your remote clock-in request has been ${actionModal.action}.${adminNote ? ` Note: ${adminNote}` : ""}`
            : `Your ${typeLabel[req.request_type]} request has been ${actionModal.action}.${adminNote ? ` Note: ${adminNote}` : ""}`,
          type: "attendance",
          reference_id: req.id,
        },
      });

      setActionModal(null);
      setAdminNote("");
      fetchRequests();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not process this request. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  const fmt = (date: string) => new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <p className="text-sm text-gray-500 mt-1">Remote work, client visits & business trips</p>
        </div>
        <button onClick={fetchRequests} className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", "pending", "approved", "rejected"] as FilterStatus[]).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${filter === s ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-100"}`}
          >{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Dates</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Proof</th>
                {filter === "pending" && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-100">{r.profiles?.full_name ?? "—"}</p>
                    <p className="text-xs text-gray-500">{r.profiles?.departments?.name ?? "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded text-xs">
                      {r.is_attendance_request ? "Instant Clock-In" : typeLabel[r.request_type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{fmt(r.from_date)} → {fmt(r.to_date)}</td>
                  <td className="px-6 py-4"><Badge variant={statusToBadge(r.status)}>{r.status}</Badge></td>
                  <td className="px-6 py-4 text-gray-500 text-xs max-w-xs truncate">{r.reason ?? "—"}</td>
                  <td className="px-6 py-4">
                    {r.selfie_url ? (
                      <div className="flex items-center gap-2">
                        <a href={r.selfie_url} target="_blank" rel="noreferrer">
                          <img src={r.selfie_url} alt="Selfie" className="w-9 h-9 rounded-lg object-cover border border-gray-700" />
                        </a>
                        {r.request_latitude != null && r.request_longitude != null && (
                          <a
                            href={`https://maps.google.com/?q=${r.request_latitude},${r.request_longitude}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            View map
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  {filter === "pending" && (
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => { setActionModal({ request: r, action: "approved" }); setAdminNote(""); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-xs font-medium transition-colors">
                          <CheckCircle2 size={12} /> Approve
                        </button>
                        <button onClick={() => { setActionModal({ request: r, action: "rejected" }); setAdminNote(""); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors">
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No {filter} remote requests.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={`${actionModal?.action === "approved" ? "Approve" : "Reject"} Remote Request`} width="sm">
        {actionModal && (
          <>
            <p className="text-sm text-gray-400 mb-4">
              {actionModal.action === "approved" ? "Approve" : "Reject"} {typeLabel[actionModal.request.request_type]} for{" "}
              <span className="text-gray-100 font-medium">{actionModal.request.profiles?.full_name}</span>?
            </p>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Admin Note (optional)</label>
              <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3}
                placeholder="Add a note..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none" />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100">Cancel</button>
              <button onClick={processAction} disabled={processing}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${actionModal.action === "approved" ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"}`}>
                {processing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : actionModal.action === "approved" ? "Approve" : "Reject"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
