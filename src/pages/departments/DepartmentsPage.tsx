import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Modal from "../../components/ui/Modal";
import Badge from "../../components/ui/Badge";
import { Plus, Edit, Trash2, RefreshCw } from "lucide-react";
import type { Department } from "../../types";

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (user) fetchDepts(); }, [user]);

  async function fetchDepts() {
    setLoading(true);
    const { data } = await supabase.from("departments").select("*").eq("company_id", user!.profile.company_id).order("name");
    setDepartments(data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", code: "", description: "" });
    setError("");
    setShowModal(true);
  }

  function openEdit(d: Department) {
    setEditTarget(d);
    setForm({ name: d.name, code: d.code ?? "", description: d.description ?? "" });
    setError("");
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) { setError("Department name is required."); return; }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || form.name.toUpperCase().replace(/\s+/g, "_").substring(0, 10),
      description: form.description || null,
    };
    if (editTarget) {
      await supabase.from("departments").update(payload).eq("id", editTarget.id);
    } else {
      await supabase.from("departments").insert({ ...payload, company_id: user!.profile.company_id });
    }
    setSaving(false);
    setShowModal(false);
    fetchDepts();
  }

  async function toggleActive(d: Department) {
    await supabase.from("departments").update({ is_active: !d.is_active }).eq("id", d.id);
    fetchDepts();
  }

  async function deleteDept(d: Department) {
    if (!confirm(`Delete department "${d.name}"? This cannot be undone.`)) return;
    await supabase.from("departments").delete().eq("id", d.id);
    fetchDepts();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <p className="text-sm text-gray-500 mt-1">{departments.filter(d => d.is_active).length} active departments</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button onClick={fetchDepts} className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> Add Department
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d) => (
            <div key={d.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-100">{d.name}</h3>
                  {d.code && <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded mt-1 inline-block">{d.code}</span>}
                </div>
                <Badge variant={d.is_active ? "success" : "neutral"}>{d.is_active ? "Active" : "Inactive"}</Badge>
              </div>
              {d.description && <p className="text-sm text-gray-500 mb-4">{d.description}</p>}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
                <button onClick={() => openEdit(d)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors">
                  <Edit size={12} /> Edit
                </button>
                <button onClick={() => toggleActive(d)} className="flex-1 py-1.5 text-xs text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors">
                  {d.is_active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => deleteDept(d)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
          {departments.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">No departments yet. Create your first one.</div>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editTarget ? "Edit Department" : "Add Department"} width="sm">
        {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Department Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Engineering"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Code (auto-generated if empty)</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. ENG"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              placeholder="Brief description..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editTarget ? "Save" : "Create"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
