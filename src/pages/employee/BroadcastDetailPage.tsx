import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import Badge from "../../components/ui/Badge";
import { ArrowLeft, Pin } from "lucide-react";
import type { Broadcast } from "../../types";

const TYPE_LABEL: Record<string, string> = { global: "Company-wide", department: "Department", emergency: "Emergency", event: "Event" };
const TYPE_VARIANT: Record<string, "info" | "danger" | "success" | "neutral"> = { global: "info", department: "neutral", emergency: "danger", event: "success" };

export default function BroadcastDetailPage() {
  const { user } = useAuth();
  const profile = user?.profile;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [broadcast, setBroadcast] = useState<Broadcast | null>((location.state as { broadcast?: Broadcast } | null)?.broadcast ?? null);
  const [loading, setLoading] = useState(!broadcast);

  useEffect(() => {
    if (broadcast || !id) return;
    supabase.from("broadcasts").select("*, departments(name)").eq("id", id).single()
      .then(({ data }) => { setBroadcast(data as Broadcast); setLoading(false); });
  }, [broadcast, id]);

  useEffect(() => {
    if (!broadcast || !profile?.id) return;
    supabase.from("broadcast_reads").upsert(
      { broadcast_id: broadcast.id, employee_id: profile.id },
      { onConflict: "broadcast_id,employee_id" },
    );
  }, [broadcast, profile?.id]);

  if (loading || !broadcast) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate("/broadcasts")} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-100 mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Announcements
      </button>

      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          {broadcast.is_pinned && <Pin size={13} className="text-yellow-400" />}
          <Badge variant={TYPE_VARIANT[broadcast.type] ?? "neutral"}>{TYPE_LABEL[broadcast.type] ?? broadcast.type}</Badge>
        </div>
        <h1 className="text-xl font-bold text-gray-100 mb-2">{broadcast.title}</h1>
        <p className="text-xs text-gray-500 mb-5">
          {new Date(broadcast.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {broadcast.departments?.name && ` · ${broadcast.departments.name}`}
          {broadcast.expires_at && ` · Expires ${new Date(broadcast.expires_at).toLocaleDateString("en-IN")}`}
        </p>
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{broadcast.message}</p>
      </div>
    </div>
  );
}
