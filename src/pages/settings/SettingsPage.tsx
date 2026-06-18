import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import type { Company, LeaveType } from "../../types";
import { Save, Plus, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (user) fetchSettings(); }, [user]);

  async function fetchSettings() {
    const [cRes, ltRes] = await Promise.all([
      supabase.from("companies").select("*").eq("id", user!.profile.company_id).single(),
      supabase.from("leave_types").select("*").eq("company_id", user!.profile.company_id).order("name"),
    ]);
    setCompany(cRes.data);
    setLeaveTypes(ltRes.data ?? []);
  }

  async function saveCompany() {
    if (!company) return;
    setSaving(true);
    await supabase.from("companies").update({
      name: company.name, email: company.email, phone: company.phone,
      address: company.address, city: company.city, state: company.state,
    }).eq("id", company.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function updateLeaveType(lt: LeaveType, field: string, value: any) {
    setLeaveTypes(leaveTypes.map((l) => l.id === lt.id ? { ...l, [field]: value } : l));
    await supabase.from("leave_types").update({ [field]: value }).eq("id", lt.id);
  }

  async function addLeaveType() {
    const { data } = await supabase.from("leave_types").insert({
      company_id: user!.profile.company_id,
      name: "New Leave", code: "NL", days_per_year: 0, is_paid: true,
    }).select().single();
    if (data) setLeaveTypes([...leaveTypes, data]);
  }

  async function deleteLeaveType(id: string) {
    if (!confirm("Delete this leave type? Existing requests will be affected.")) return;
    await supabase.from("leave_types").delete().eq("id", id);
    setLeaveTypes(leaveTypes.filter((l) => l.id !== id));
  }

  if (!company) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-sm text-gray-500 mt-1">Manage company profile and leave policies</p>
      </div>

      {/* Company Info */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-100 mb-5">Company Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          {([
            { label: "Company Name", key: "name" },
            { label: "Email", key: "email" },
            { label: "Phone", key: "phone" },
            { label: "Address", key: "address" },
            { label: "City", key: "city" },
            { label: "State", key: "state" },
          ] as { label: string; key: keyof Company }[]).map(({ label, key }) => (
            <div key={key}>
              <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
              <input
                value={(company[key] as string) ?? ""}
                onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-800">
          {saved && <span className="text-sm text-green-400">Saved successfully!</span>}
          <button onClick={saveCompany} disabled={saving}
            className="ml-auto flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>

      {/* Leave Types */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-100">Leave Types</h2>
          <button onClick={addLeaveType} className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300">
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {leaveTypes.map((lt) => (
            <div key={lt.id} className="flex items-center gap-3 p-3 bg-gray-800 border border-gray-700 rounded-lg">
              <input value={lt.name} onChange={(e) => updateLeaveType(lt, "name", e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none min-w-0" />
              <input value={lt.code} onChange={(e) => updateLeaveType(lt, "code", e.target.value.toUpperCase())}
                className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 font-mono focus:outline-none" />
              <input type="number" value={lt.days_per_year} onChange={(e) => updateLeaveType(lt, "days_per_year", parseFloat(e.target.value))}
                className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none" />
              <span className="text-xs text-gray-500">days/yr</span>
              <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={lt.is_paid} onChange={(e) => updateLeaveType(lt, "is_paid", e.target.checked)} className="accent-indigo-500" />
                Paid
              </label>
              <button onClick={() => deleteLeaveType(lt.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {leaveTypes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No leave types configured.</p>}
        </div>
      </div>
    </div>
  );
}
