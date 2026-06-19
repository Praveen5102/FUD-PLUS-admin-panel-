import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Modal from "../../components/ui/Modal";
import Badge from "../../components/ui/Badge";
import { statusToBadge } from "../../lib/badge";
import { Plus, Search, Trash2, Edit, RefreshCw, Upload, ShieldCheck, Copy, Check } from "lucide-react";
import type { Profile, Department } from "../../types";

interface EmployeeForm {
  full_name: string; email: string; phone: string;
  department_id: string; employee_id: string;
  joining_date: string; status: "active" | "inactive" | "resigned";
}

const emptyForm: EmployeeForm = {
  full_name: "", email: "", phone: "", department_id: "", employee_id: "",
  joining_date: new Date().toISOString().split("T")[0], status: "active",
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPasswordCard, setShowPasswordCard] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [empRes, deptRes] = await Promise.all([
      supabase.from("profiles")
        .select("*, departments(id, name), user_roles(id, name)")
        .eq("company_id", user!.profile.company_id)
        .order("created_at", { ascending: false }),
      supabase.from("departments").select("*").eq("company_id", user!.profile.company_id).eq("is_active", true),
    ]);
    setEmployees((empRes.data as Profile[]) ?? []);
    setDepartments((deptRes.data as Department[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) Promise.resolve().then(() => fetchAll());
  }, [user, fetchAll]);

  // Deep-link from EmployeeDetailPage's Edit button (?edit=<id>)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && employees.length) {
      const target = employees.find((e) => e.id === editId);
      if (target) {
        openEdit(target);
        setSearchParams({}, { replace: true });
      }
    }
  }, [employees, searchParams, setSearchParams]);

  const filtered = employees.filter((e) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setError("");
    setShowModal(true);
  }

  function openEdit(emp: Profile) {
    setEditTarget(emp);
    setForm({
      full_name: emp.full_name, email: emp.email, phone: emp.phone ?? "",
      department_id: emp.department_id ?? "", employee_id: emp.employee_id,
      joining_date: emp.joining_date ?? "", status: emp.status,
    });
    setPhotoFile(null);
    setPhotoPreview(emp.profile_image ?? null);
    setError("");
    setShowModal(true);
  }

  function onPhotoSelected(file: File | null) {
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function save() {
    setError("");
    if (!form.full_name || !form.email || !form.employee_id) { setError("Name, email and employee ID are required."); return; }
    setSaving(true);
    try {
      if (editTarget) {
        const { error: upErr } = await supabase.from("profiles").update({
          full_name: form.full_name, phone: form.phone,
          department_id: form.department_id || null,
          joining_date: form.joining_date || null,
          status: form.status,
        }).eq("id", editTarget.id);
        if (upErr) throw upErr;
        setShowModal(false);
        fetchAll();
      } else {
        // Upload photo first (if provided), matching the mobile app's flow
        let uploadedImage: string | null = null;
        if (photoFile) {
          const fileName = `employee_${Date.now()}.jpg`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("profile-images")
            .upload(fileName, photoFile, { contentType: photoFile.type, upsert: false });
          if (!uploadErr && uploadData) {
            uploadedImage = supabase.storage.from("profile-images").getPublicUrl(uploadData.path).data.publicUrl;
          }
        }

        const password = generatePassword();

        // Call create-employee, the same edge function the mobile app's
        // AddEmployeeModal uses — it derives company_id from the caller's
        // JWT and defaults the new profile to the "employee" role.
        const { data, error: fnErr } = await supabase.functions.invoke("create-employee", {
          body: {
            full_name: form.full_name, email: form.email, phone: form.phone,
            department_id: form.department_id || null, employee_id: form.employee_id,
            joining_date: form.joining_date || null, profile_image: uploadedImage,
            password,
          },
        });
        if (fnErr || data?.success === false) throw new Error(fnErr?.message ?? data?.error ?? "Failed to create employee.");

        setShowModal(false);
        setGeneratedPassword(password);
        setShowPasswordCard(true);
        fetchAll();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function deleteEmployee(id: string, name: string) {
    if (!confirm(`Permanently delete ${name} and all their data?`)) return;
    await supabase.rpc("purge_employee_cascade", { target_profile_id: id });
    fetchAll();
  }

  const fmt = (date: string | null) => date ? new Date(date).toLocaleDateString("en-IN") : "—";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <p className="text-sm text-gray-500 mt-1">{employees.filter(e => e.status === "active").length} active employees</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchAll} className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or employee ID..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Table */}
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
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((emp) => (
                <tr key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)} className="hover:bg-gray-800/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {emp.profile_image ? (
                        <img src={emp.profile_image} alt={emp.full_name} className="w-9 h-9 rounded-full object-cover border border-white/10" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-semibold text-indigo-300 uppercase">
                          {emp.full_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-100">{emp.full_name}</p>
                        <p className="text-xs text-gray-500">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 font-mono text-xs">{emp.employee_id}</td>
                  <td className="px-6 py-4 text-gray-400">{emp.departments?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-400">{fmt(emp.joining_date)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={statusToBadge(emp.status)}>{emp.status}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openEdit(emp)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => deleteEmployee(emp.id, emp.full_name)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editTarget ? "Edit Employee" : "Add Employee"} width="lg">
        {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        {/* Photo upload */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1.5">Photo</label>
          <label className="flex items-center gap-4 cursor-pointer group">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center group-hover:border-indigo-500 transition-colors">
                <Upload size={18} className="text-gray-500 group-hover:text-indigo-400" />
              </div>
            )}
            <div>
              <p className="text-sm text-gray-300 group-hover:text-indigo-400 transition-colors">Upload Photo</p>
              <p className="text-xs text-gray-500">JPG or PNG, square recommended</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              { label: "Full Name *", key: "full_name", type: "text", placeholder: "John Smith" },
              { label: "Email *", key: "email", type: "email", placeholder: "john@company.com", disabled: !!editTarget },
              { label: "Employee ID *", key: "employee_id", type: "text", placeholder: "EMP001", disabled: !!editTarget },
              { label: "Phone", key: "phone", type: "tel", placeholder: "+91 98765 43210" },
              { label: "Joining Date", key: "joining_date", type: "date" },
            ] as { label: string; key: keyof Pick<EmployeeForm, "full_name" | "email" | "employee_id" | "phone" | "joining_date">; type: string; placeholder?: string; disabled?: boolean }[]
          ).map(({ label, key, type, placeholder, disabled }) => (
            <div key={key}>
              <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Department</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EmployeeForm["status"] })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="resigned">Resigned</option>
            </select>
          </div>

        </div>

        {!editTarget && (
          <p className="text-xs text-gray-500 mt-4">
            A secure temporary password will be generated automatically and shown to you once the employee is created.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editTarget ? "Save Changes" : "Create Employee"}
          </button>
        </div>
      </Modal>

      {/* Generated password popup — mirrors mobile app's AddEmployeeModal success card */}
      {showPasswordCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm glass-card rounded-3xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={28} className="text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-100">Employee Created!</h2>
            <p className="text-sm text-gray-400 mt-1.5">Share this temporary password with the employee.</p>
            <div className="mt-5 py-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-2xl font-bold text-indigo-300 tracking-widest">{generatedPassword}</p>
            </div>
            <button onClick={copyPassword} className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied!" : "Copy Password"}
            </button>
            <button onClick={() => setShowPasswordCard(false)} className="w-full mt-2 px-4 py-2.5 text-gray-400 hover:text-gray-100 rounded-xl text-sm font-medium transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
