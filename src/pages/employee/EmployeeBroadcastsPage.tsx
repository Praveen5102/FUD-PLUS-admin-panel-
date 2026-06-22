import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import Badge from "../../components/ui/Badge";
import { Megaphone, Pin } from "lucide-react";
import type { Broadcast } from "../../types";

const TYPE_LABEL: Record<string, string> = { global: "Company-wide", department: "Department", emergency: "Emergency", event: "Event" };
const TYPE_VARIANT: Record<string, "info" | "danger" | "success" | "neutral"> = { global: "info", department: "neutral", emergency: "danger", event: "success" };

export default function EmployeeBroadcastsPage() {
  const { user } = useAuth();
  const profile = user?.profile;
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState<(Broadcast & { read_by_user: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    let filter = `type.eq.global,type.eq.emergency,type.eq.event`;
    if (profile.department_id) {
      filter += `,and(type.eq.department,target_department_id.eq.${profile.department_id})`;
    }
    const [bRes, readsRes] = await Promise.all([
      supabase
        .from("broadcasts")
        .select("*, departments(name)")
        .eq("company_id", profile.company_id)
        .or(filter)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("broadcast_reads").select("broadcast_id").eq("employee_id", profile.id),
    ]);
    const readSet = new Set((readsRes.data ?? []).map((r) => r.broadcast_id));
    setBroadcasts(((bRes.data as Broadcast[]) ?? []).map((b) => ({ ...b, read_by_user: readSet.has(b.id) })));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    Promise.resolve().then(() => fetchAll());
  }, [fetchAll]);

  const unreadCount = broadcasts.filter((b) => !b.read_by_user).length;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <p className="text-sm text-gray-400 mb-6">{unreadCount} unread of {broadcasts.length} announcements</p>

      <div className="space-y-3">
        {broadcasts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Megaphone size={28} className="mx-auto mb-2 opacity-30" />
            No announcements yet.
          </div>
        ) : (
          broadcasts.map((b) => (
            <button
              key={b.id}
              onClick={() => navigate(`/broadcasts/${b.id}`, { state: { broadcast: b } })}
              className={`w-full text-left glass-card rounded-2xl p-4 transition-colors hover:border-white/15 ${!b.read_by_user ? "border-indigo-400/30" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {b.is_pinned && <Pin size={12} className="text-yellow-400" />}
                <Badge variant={TYPE_VARIANT[b.type] ?? "neutral"}>{TYPE_LABEL[b.type] ?? b.type}</Badge>
                {!b.read_by_user && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
              </div>
              <h3 className="font-semibold text-gray-100 mb-1">{b.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-2">{b.message}</p>
              <p className="text-xs text-gray-500 mt-2">{fmtDate(b.created_at)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
