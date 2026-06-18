import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Modal from "../../components/ui/Modal";
import { Plus, Pin, Trash2, RefreshCw, Megaphone } from "lucide-react";
import type { Broadcast, Department } from "../../types";

const typeColors: Record<string, string> = {
  global:     "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  department: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  emergency:  "bg-red-500/10 text-red-400 border-red-500/20",
  event:      "bg-green-500/10 text-green-400 border-green-500/20",
};

export default function BroadcastsPage() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", type: "global" as Broadcast["type"], target_department_id: "", expires_at: "", is_pinned: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) fetchAll(); }, [user]);

  async function fetchAll() {
    setLoading(true);
    const [bRes, dRes] = await Promise.all([
      supabase.from("broadcasts").select("*, departments(name), profiles!created_by(full_name)").eq("company_id", user!.profile.company_id).order("created_at", { ascending: false }),
      supabase.from("departments").select("*").eq("company_id", user!.profile.company_id).eq("is_active", true),
    ]);
    setBroadcasts((bRes.data as Broadcast[]) ?? []);
    setDepartments((dRes.data as Department[]) ?? []);
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    await supabase.from("broadcasts").insert({
      company_id: user!.profile.company_id,
      created_by: user!.profile.id,
      title: form.title, message: form.message, type: form.type,
      target_department_id: form.type === "department" ? form.target_department_id || null : null,
      expires_at: form.expires_at || null,
      is_pinned: form.is_pinned,
    });
    setSaving(false);
    setShowModal(false);
    setForm({ title: "", message: "", type: "global", target_department_id: "", expires_at: "", is_pinned: false });
    fetchAll();
  }

  async function deleteBroadcast(id: string) {
    if (!confirm("Delete this broadcast?")) return;
    await supabase.from("broadcasts").delete().eq("id", id);
    fetchAll();
  }

  async function togglePin(b: Broadcast) {
    await supabase.from("broadcasts").update({ is_pinned: !b.is_pinned }).eq("id", b.id);
    fetchAll();
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-500 mt-1">{broadcasts.length} announcements</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchAll} className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"><RefreshCw size={16} /></button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New Broadcast
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {broadcasts.map((b) => (
            <div key={b.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${typeColors[b.type]}`}>{b.type}</span>
                    {b.is_pinned && <Pin size={12} className="text-yellow-400" />}
                    {b.target_department_id && <span className="text-xs text-gray-500">→ {(b.departments as any)?.name}</span>}
                  </div>
                  <h3 className="font-semibold text-gray-100 mb-1">{b.title}</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">{b.message}</p>
                  <p className="text-xs text-gray-400 mt-2">By {(b.profiles as any)?.full_name ?? "Admin"} · {fmt(b.created_at)}</p>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button onClick={() => togglePin(b)} className={`p-1.5 rounded transition-colors ${b.is_pinned ? "text-yellow-400 hover:text-yellow-300" : "text-gray-500 hover:text-yellow-400"} hover:bg-yellow-500/10`}>
                    <Pin size={14} />
                  </button>
                  <button onClick={() => deleteBroadcast(b.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {broadcasts.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Megaphone size={32} className="mx-auto mb-3 opacity-30" />
              No broadcasts yet. Create your first announcement.
            </div>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Broadcast" width="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Message *</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Broadcast message..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Broadcast["type"] })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
                <option value="global">Global (all employees)</option>
                <option value="department">Department</option>
                <option value="emergency">Emergency</option>
                <option value="event">Event</option>
              </select>
            </div>
            {form.type === "department" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Target Department</label>
                <select value={form.target_department_id} onChange={(e) => setForm({ ...form, target_department_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Expires At (optional)</label>
              <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} className="accent-indigo-500" />
            <span className="text-sm text-gray-300">Pin this broadcast</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100">Cancel</button>
          <button onClick={save} disabled={saving || !form.title || !form.message}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Publish"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
