import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Bell, Calendar, Megaphone, AlertCircle, Clock, Check } from "lucide-react";
import type { Notification } from "../../types";

const TYPE_FILTERS = ["all", "attendance", "leave", "broadcast", "system", "alert"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const TYPE_ICON: Record<string, React.ReactNode> = {
  attendance: <Clock size={16} className="text-indigo-400" />,
  leave: <Calendar size={16} className="text-purple-400" />,
  broadcast: <Megaphone size={16} className="text-yellow-400" />,
  system: <Bell size={16} className="text-gray-400" />,
  alert: <AlertCircle size={16} className="text-red-400" />,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const profile = user?.profile;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    let q = supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") q = q.eq("type", filter);
    const { data } = await q;
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [profile, filter]);

  useEffect(() => {
    Promise.resolve().then(() => fetchAll());
  }, [fetchAll]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllRead() {
    if (!profile) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{unreadCount} unread</p>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300">
            <Check size={13} /> Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize shrink-0 ${filter === t ? "bg-indigo-600 text-white" : "bg-white/5 text-gray-400 hover:text-gray-100"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Bell size={28} className="mx-auto mb-2 opacity-30" />
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`w-full text-left glass-card rounded-xl p-4 flex items-start gap-3 transition-colors hover:border-white/15 ${!n.is_read ? "border-indigo-400/30" : ""}`}
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">{TYPE_ICON[n.type] ?? <Bell size={16} />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-100 truncate">{n.title}</p>
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                  </div>
                  {n.message && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-[11px] text-gray-500 mt-1">{fmtTime(n.created_at)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
