import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Modal from "../../components/ui/Modal";
import { Plus, Trash2, RefreshCw, Sun, CalendarDays } from "lucide-react";
import type { Holiday } from "../../types";
import { fetchGoogleHolidaysForYear } from "../../lib/googleHolidays";

const typeColors: Record<string, string> = {
  public:   "bg-green-500/10 text-green-400 border border-green-500/20",
  company:  "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  optional: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
};

export default function HolidaysPage() {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", holiday_date: "", holiday_type: "company" as Holiday["holiday_type"], description: "" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => { if (user) fetchHolidays(); }, [user]);

  async function fetchHolidays() {
    setLoading(true);
    const { data } = await supabase.from("holidays").select("*").eq("company_id", user!.profile.company_id).order("holiday_date");
    setHolidays(data ?? []);
    setLoading(false);
  }

  async function save() {
    if (!form.title || !form.holiday_date) return;
    setSaving(true);
    await supabase.from("holidays").insert({ ...form, company_id: user!.profile.company_id, is_active: true });
    setSaving(false);
    setShowModal(false);
    setForm({ title: "", holiday_date: "", holiday_type: "company", description: "" });
    fetchHolidays();
  }

  async function deleteHoliday(id: string) {
    if (!confirm("Delete this holiday?")) return;
    await supabase.from("holidays").delete().eq("id", id);
    fetchHolidays();
  }

  async function syncFromGoogle() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const year = new Date().getFullYear();
      const fetched = await fetchGoogleHolidaysForYear(year);
      const existingDates = new Set(holidays.map((h) => h.holiday_date));
      const newRows = fetched
        .filter((h) => h.holiday_date && !existingDates.has(h.holiday_date))
        .map((h) => ({
          company_id: user!.profile.company_id,
          title: h.title,
          holiday_date: h.holiday_date,
          holiday_type: "public" as const,
          description: h.description,
          is_active: true,
        }));
      if (newRows.length > 0) {
        const { error } = await supabase.from("holidays").insert(newRows);
        if (error) throw error;
      }
      setSyncMsg(newRows.length > 0 ? `Added ${newRows.length} public holidays for ${year}.` : `Already up to date for ${year}.`);
      fetchHolidays();
    } catch (err: any) {
      setSyncMsg(err.message ?? "Failed to sync holidays from Google Calendar.");
    } finally {
      setSyncing(false);
    }
  }

  const groupByMonth = () => {
    const groups: Record<string, Holiday[]> = {};
    holidays.forEach((h) => {
      const month = new Date(h.holiday_date).toLocaleDateString("en-IN", { year: "numeric", month: "long" });
      if (!groups[month]) groups[month] = [];
      groups[month].push(h);
    });
    return groups;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-500 mt-1">{holidays.length} holidays configured</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchHolidays} className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"><RefreshCw size={16} /></button>
          <button onClick={syncFromGoogle} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {syncing ? <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> : <CalendarDays size={16} />}
            Sync from Google Calendar
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> Add Holiday
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">{syncMsg}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Sun size={32} className="mx-auto mb-3 opacity-30" />
          No holidays added yet.
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupByMonth()).map(([month, items]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{month}</h2>
              <div className="space-y-2">
                {items.map((h) => (
                  <div key={h.id} className="flex items-center justify-between glass-card rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="text-center w-10">
                        <p className="text-xl font-bold text-gray-100">{new Date(h.holiday_date).getDate()}</p>
                        <p className="text-xs text-gray-500">{new Date(h.holiday_date).toLocaleDateString("en-IN", { weekday: "short" })}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-100">{h.title}</p>
                        {h.description && <p className="text-xs text-gray-500">{h.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${typeColors[h.holiday_type ?? "company"]}`}>{h.holiday_type}</span>
                      <button onClick={() => deleteHoliday(h.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Holiday" width="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Holiday Name *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Independence Day"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Date *</label>
            <input type="date" value={form.holiday_date} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Type</label>
            <select value={form.holiday_type} onChange={(e) => setForm({ ...form, holiday_type: e.target.value as Holiday["holiday_type"] })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
              <option value="public">Public (national)</option>
              <option value="company">Company (office closed)</option>
              <option value="optional">Optional (employee choice)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Description (optional)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Additional details"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100">Cancel</button>
          <button onClick={save} disabled={saving || !form.title || !form.holiday_date}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Add Holiday"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
