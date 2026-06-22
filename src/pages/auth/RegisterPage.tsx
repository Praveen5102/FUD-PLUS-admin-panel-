import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabaseUrl, supabaseAnonKey } from "../../lib/supabase";
import { supabase } from "../../lib/supabase";
import {
  ChevronRight, ChevronLeft, Building2, MapPin, User, Calendar,
  Plus, X, CheckCircle2, Upload, Clock, Moon, Trash2, Check,
} from "lucide-react";
import logo from "../../assets/logo.png";

// ─── Types ───────────────────────────────────────────────
interface CompanyForm { name: string; email: string; phone: string; address: string; city: string; state: string; }
interface LocationForm { name: string; latitude: string; longitude: string; radius_in_meters: string; }
interface AdminForm { full_name: string; email: string; password: string; confirmPassword: string; phone: string; }
interface ShiftRow { name: string; start_time: string; end_time: string; is_night_shift: boolean; }
interface LeaveTypeRow { name: string; code: string; days_per_year: string; is_paid: boolean; requires_approval: boolean; }
interface DepartmentRow { name: string; weekoff_days: string; shift_index: number; duty_hours: string; leave_type_indices: number[]; }

const DEFAULT_LEAVE_TYPES: LeaveTypeRow[] = [
  { name: "Casual Leave", code: "CL", days_per_year: "12", is_paid: true, requires_approval: true },
  { name: "Sick Leave",   code: "SL", days_per_year: "10", is_paid: true, requires_approval: false },
  { name: "Earned Leave", code: "EL", days_per_year: "15", is_paid: true, requires_approval: true },
];
const DEFAULT_DEPARTMENTS_LIST = ["HR", "IT", "Sales", "Finance", "Operations", "Marketing"];
const WEEKOFF_OPTIONS = [
  { key: "sunday", label: "Sunday" },
  { key: "sat_sun", label: "Sat + Sun" },
  { key: "rotational", label: "Rotational" },
  { key: "none", label: "None" },
];

const STEPS = [
  { label: "Company",  icon: Building2 },
  { label: "Location", icon: MapPin },
  { label: "Admin",    icon: User },
  { label: "Shifts",   icon: Clock },
  { label: "Leave",    icon: Calendar },
  { label: "Depts",    icon: Building2 },
];

// ─── Input helpers ────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
    />
  );
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [company, setCompany] = useState<CompanyForm>({ name: "", email: "", phone: "", address: "", city: "", state: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [location, setLocation] = useState<LocationForm>({ name: "Head Office", latitude: "", longitude: "", radius_in_meters: "100" });
  const [locating, setLocating] = useState(false);

  const [admin, setAdmin] = useState<AdminForm>({ full_name: "", email: "", password: "", confirmPassword: "", phone: "" });

  const [shifts, setShifts] = useState<ShiftRow[]>([{ name: "General Shift", start_time: "09:00", end_time: "18:00", is_night_shift: false }]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>(DEFAULT_LEAVE_TYPES);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [deptInput, setDeptInput] = useState("");

  const makeDept = (name: string): DepartmentRow => ({
    name, weekoff_days: "sunday", shift_index: 0, duty_hours: "8",
    leave_type_indices: leaveTypes.map((_, i) => i),
  });

  // GPS fetch
  const fetchGPS = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation((l) => ({ ...l, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
      },
      () => setLocating(false),
    );
  };

  const onLogoSelected = (file: File | null) => {
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  // Validate each step before proceeding
  const validateStep = (): string | null => {
    if (step === 0) {
      if (!company.name.trim()) return "Company name is required.";
      if (!company.email.trim()) return "Company email is required.";
      if (!company.phone.trim()) return "Company phone is required.";
    }
    if (step === 1) {
      if (!location.latitude || !location.longitude) return "Office latitude and longitude are required.";
    }
    if (step === 2) {
      if (!admin.full_name.trim()) return "Admin full name is required.";
      if (!admin.email.trim()) return "Admin email is required.";
      if (admin.password.length < 8) return "Password must be at least 8 characters.";
      if (admin.password !== admin.confirmPassword) return "Passwords do not match.";
    }
    if (step === 3) {
      if (shifts.length === 0) return "Add at least one shift.";
      for (const s of shifts) if (!s.name.trim()) return "All shifts need a name.";
    }
    if (step === 4) {
      if (leaveTypes.length === 0) return "Add at least one leave type.";
      for (const lt of leaveTypes) if (!lt.name.trim() || !lt.code.trim()) return "All leave types need a name and code.";
    }
    if (step === 5) {
      if (departments.length === 0) return "Add at least one department.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => s + 1);
  };

  const prev = () => { setError(""); setStep((s) => s - 1); };

  const addDept = (name: string) => {
    const v = name.trim();
    if (!v) return;
    if (departments.some((d) => d.name.toLowerCase() === v.toLowerCase())) return;
    setDepartments((d) => [...d, makeDept(v)]);
    setDeptInput("");
  };
  const toggleQuickDept = (name: string) => {
    const exists = departments.some((d) => d.name.toLowerCase() === name.toLowerCase());
    if (exists) setDepartments((d) => d.filter((x) => x.name.toLowerCase() !== name.toLowerCase()));
    else addDept(name);
  };
  const removeDept = (i: number) => setDepartments((d) => d.filter((_, idx) => idx !== i));
  const updateDept = (i: number, patch: Partial<DepartmentRow>) =>
    setDepartments((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const toggleDeptLeave = (deptIdx: number, ltIdx: number) =>
    setDepartments((prev) => prev.map((d, i) => {
      if (i !== deptIdx) return d;
      const has = d.leave_type_indices.includes(ltIdx);
      return { ...d, leave_type_indices: has ? d.leave_type_indices.filter((x) => x !== ltIdx) : [...d.leave_type_indices, ltIdx] };
    }));

  const addShift = () => setShifts((s) => [...s, { name: "", start_time: "09:00", end_time: "18:00", is_night_shift: false }]);
  const removeShift = (i: number) => setShifts((s) => s.filter((_, idx) => idx !== i));
  const updateShift = (i: number, patch: Partial<ShiftRow>) => setShifts((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const addLeaveType = () => {
    const newIndex = leaveTypes.length;
    setLeaveTypes((lt) => [...lt, { name: "", code: "", days_per_year: "10", is_paid: true, requires_approval: true }]);
    setDepartments((d) => d.map((x) => ({ ...x, leave_type_indices: [...x.leave_type_indices, newIndex] })));
  };
  const removeLeaveType = (ltIdx: number) => {
    setLeaveTypes((lt) => lt.filter((_, i) => i !== ltIdx));
    setDepartments((d) => d.map((x) => ({
      ...x,
      leave_type_indices: x.leave_type_indices.filter((i) => i !== ltIdx).map((i) => (i > ltIdx ? i - 1 : i)),
    })));
  };
  const updateLeaveType = (i: number, patch: Partial<LeaveTypeRow>) => setLeaveTypes((lt) => lt.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;
    const fileName = `logo_${Date.now()}.jpg`;
    const { data, error: upErr } = await supabase.storage.from("company-logos").upload(fileName, logoFile, { contentType: logoFile.type, upsert: false });
    if (upErr || !data) return null;
    return supabase.storage.from("company-logos").getPublicUrl(data.path).data.publicUrl;
  };

  const submit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setSubmitting(true);

    try {
      const logoUrl = await uploadLogo();

      const res = await fetch(`${supabaseUrl}/functions/v1/company-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
        body: JSON.stringify({
          company: { name: company.name, email: company.email, phone: company.phone, address: company.address || null, city: company.city || null, state: company.state || null, logo_url: logoUrl },
          location: { name: location.name, latitude: parseFloat(location.latitude), longitude: parseFloat(location.longitude), radius_in_meters: parseInt(location.radius_in_meters) || 100 },
          admin: { full_name: admin.full_name, email: admin.email, password: admin.password, phone: admin.phone || null },
          shifts: shifts.map((s) => ({ name: s.name.trim(), start_time: s.start_time, end_time: s.end_time, is_night_shift: s.is_night_shift })),
          departments: departments.map((d) => ({ name: d.name, weekoff_days: d.weekoff_days, shift_index: d.shift_index, duty_hours: parseFloat(d.duty_hours) || 8, leave_type_indices: d.leave_type_indices })),
          leaveTypes: leaveTypes.map((lt) => ({ name: lt.name.trim(), code: (lt.code.trim() || lt.name.trim().slice(0, 3)).toUpperCase(), days_per_year: parseFloat(lt.days_per_year), is_paid: lt.is_paid, requires_approval: lt.requires_approval })),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess(true);
      } else {
        throw new Error(json.error ?? "Registration failed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="app-gradient-bg flex items-center justify-center p-4 sm:p-6 min-h-screen">
        <div className="text-center w-full max-w-sm">
          <CheckCircle2 size={64} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Company Registered!</h2>
          <p className="text-gray-400 text-sm mb-6">
            Your company has been set up successfully. Log in using your admin credentials.
          </p>
          <button onClick={() => navigate("/login")} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-gradient-bg min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="FUD Plus" className="w-14 h-14 rounded-xl object-cover mx-auto mb-3 shadow-lg shadow-indigo-900/40" />
          <h1 className="text-2xl font-bold text-gray-100">Register Your Company</h1>
          <p className="text-sm text-gray-400 mt-1">Set up FUD Plus HRMS for your organization</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-8 flex-wrap">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active ? "bg-indigo-600 text-white" : done ? "bg-indigo-500/20 text-indigo-400" : "bg-gray-800 text-gray-500"
                }`}>
                  {done ? <Check size={12} /> : <Icon size={12} />}
                  {s.label}
                </div>
                {i < STEPS.length - 1 && <ChevronRight size={12} className="text-gray-400" />}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-6 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 0 — Company Info + Logo */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-100 mb-4">Company Information</h3>

              <Field label="Company Logo (optional)">
                <label className="flex items-center gap-4 cursor-pointer group">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center group-hover:border-indigo-500 transition-colors">
                      <Upload size={18} className="text-gray-500 group-hover:text-indigo-400" />
                    </div>
                  )}
                  <span className="text-sm text-gray-400 group-hover:text-indigo-400 transition-colors">Tap to upload logo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogoSelected(e.target.files?.[0] ?? null)} />
                </label>
              </Field>

              <Field label="Company Name *">
                <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Acme Technologies Pvt Ltd" />
              </Field>
              <Field label="Business Email *">
                <Input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} placeholder="hr@acme.com" />
              </Field>
              <Field label="Phone Number *">
                <Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} placeholder="+91 98765 43210" />
              </Field>
              <Field label="Address">
                <Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} placeholder="123 MG Road" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="City">
                  <Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} placeholder="Bengaluru" />
                </Field>
                <Field label="State">
                  <Input value={company.state} onChange={(e) => setCompany({ ...company, state: e.target.value })} placeholder="Karnataka" />
                </Field>
              </div>
            </div>
          )}

          {/* Step 1 — Office Location */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-100 mb-4">Office Location</h3>
              <p className="text-sm text-gray-400">This location is used for GPS-based attendance clock-in radius verification.</p>
              <Field label="Location Name">
                <Input value={location.name} onChange={(e) => setLocation({ ...location, name: e.target.value })} placeholder="Head Office" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Latitude *">
                  <Input value={location.latitude} onChange={(e) => setLocation({ ...location, latitude: e.target.value })} placeholder="12.9716" />
                </Field>
                <Field label="Longitude *">
                  <Input value={location.longitude} onChange={(e) => setLocation({ ...location, longitude: e.target.value })} placeholder="77.5946" />
                </Field>
              </div>
              <button
                type="button"
                onClick={fetchGPS}
                disabled={locating}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-sm text-green-400 transition-colors disabled:opacity-50"
              >
                {locating ? <div className="w-3.5 h-3.5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : <MapPin size={14} />}
                Use my current location
              </button>
              <Field label="Clock-in Radius (meters)">
                <Input type="number" value={location.radius_in_meters} onChange={(e) => setLocation({ ...location, radius_in_meters: e.target.value })} placeholder="100" min="10" max="5000" />
              </Field>
              <p className="text-xs text-gray-500">Recommended: 50–200 m. Employees must be within this radius to clock in.</p>
            </div>
          )}

          {/* Step 2 — Admin Account */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-100 mb-4">Admin Account</h3>
              <p className="text-sm text-gray-400">This will be the super admin account for your company.</p>
              <Field label="Full Name *">
                <Input value={admin.full_name} onChange={(e) => setAdmin({ ...admin, full_name: e.target.value })} placeholder="John Smith" />
              </Field>
              <Field label="Email *">
                <Input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} placeholder="john@acme.com" />
              </Field>
              <Field label="Phone">
                <Input value={admin.phone} onChange={(e) => setAdmin({ ...admin, phone: e.target.value })} placeholder="+91 98765 43210" />
              </Field>
              <Field label="Password * (min 8 characters)">
                <Input type="password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} placeholder="Min. 8 characters" />
              </Field>
              <Field label="Confirm Password *">
                <Input type="password" value={admin.confirmPassword} onChange={(e) => setAdmin({ ...admin, confirmPassword: e.target.value })} placeholder="Re-enter password" />
              </Field>
            </div>
          )}

          {/* Step 3 — Shifts */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-100 mb-1">Work Shifts</h3>
              <p className="text-sm text-gray-400 mb-3">Define your company's working hours.</p>
              {shifts.map((shift, i) => (
                <div key={i} className="p-4 bg-gray-800/60 rounded-xl border border-gray-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Shift {i + 1}</span>
                    {shifts.length > 1 && (
                      <button onClick={() => removeShift(i)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <Field label="Shift Name *">
                    <Input value={shift.name} onChange={(e) => updateShift(i, { name: e.target.value })} placeholder="e.g. Morning Shift" />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Start Time *">
                      <Input type="time" value={shift.start_time} onChange={(e) => updateShift(i, { start_time: e.target.value })} />
                    </Field>
                    <Field label="End Time *">
                      <Input type="time" value={shift.end_time} onChange={(e) => updateShift(i, { end_time: e.target.value })} />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={shift.is_night_shift} onChange={(e) => updateShift(i, { is_night_shift: e.target.checked })} className="accent-indigo-500" />
                    <Moon size={13} /> Night Shift
                  </label>
                </div>
              ))}
              <button onClick={addShift} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300">
                <Plus size={14} /> Add Another Shift
              </button>
            </div>
          )}

          {/* Step 4 — Leave Types */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-100 mb-1">Leave Types</h3>
              <p className="text-sm text-gray-400 mb-3">Define leave types here — you'll assign them per department next.</p>
              {leaveTypes.map((lt, i) => (
                <div key={i} className="p-4 bg-gray-800/60 rounded-xl border border-gray-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Leave {i + 1}</span>
                    {leaveTypes.length > 1 && (
                      <button onClick={() => removeLeaveType(i)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Input value={lt.name} onChange={(e) => updateLeaveType(i, { name: e.target.value })} placeholder="e.g. Casual Leave" />
                    </div>
                    <Input value={lt.code} onChange={(e) => updateLeaveType(i, { code: e.target.value.toUpperCase() })} placeholder="CL" maxLength={5} />
                  </div>
                  <Input type="number" value={lt.days_per_year} onChange={(e) => updateLeaveType(i, { days_per_year: e.target.value })} placeholder="Days per year" />
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={lt.is_paid} onChange={(e) => updateLeaveType(i, { is_paid: e.target.checked })} className="accent-indigo-500" />
                      Paid Leave
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={lt.requires_approval} onChange={(e) => updateLeaveType(i, { requires_approval: e.target.checked })} className="accent-indigo-500" />
                      Requires Approval
                    </label>
                  </div>
                </div>
              ))}
              <button onClick={addLeaveType} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                <Plus size={14} /> Add Leave Type
              </button>
            </div>
          )}

          {/* Step 5 — Departments (shift + weekoff + leave assignment) */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-gray-100 mb-1">Departments</h3>
                <p className="text-sm text-gray-400 mb-3">Configure shifts, week-offs and leaves per department.</p>

                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Quick Add</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {DEFAULT_DEPARTMENTS_LIST.map((d) => (
                    <Chip key={d} active={departments.some((x) => x.name.toLowerCase() === d.toLowerCase())} onClick={() => toggleQuickDept(d)}>
                      {departments.some((x) => x.name.toLowerCase() === d.toLowerCase()) ? "✓ " : "+ "}{d}
                    </Chip>
                  ))}
                </div>

                <div className="flex gap-2 mb-4">
                  <input
                    value={deptInput}
                    onChange={(e) => setDeptInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDept(deptInput); } }}
                    placeholder="Add custom department..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button onClick={() => addDept(deptInput)} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                    <Plus size={16} />
                  </button>
                </div>

                {departments.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">Use the quick-add chips above or type a custom department name.</p>
                )}

                <div className="space-y-4">
                  {departments.map((dept, di) => (
                    <div key={di} className="p-4 bg-purple-500/5 rounded-xl border border-purple-500/15 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-purple-300">{dept.name}</span>
                        <button onClick={() => removeDept(di)} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assigned Shift</p>
                        <div className="flex flex-wrap gap-2">
                          {shifts.map((s, si) => (
                            <Chip key={si} active={dept.shift_index === si} onClick={() => updateDept(di, { shift_index: si })}>
                              {s.name || `Shift ${si + 1}`}{s.is_night_shift ? " 🌙" : ""}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Week Off</p>
                        <div className="flex flex-wrap gap-2">
                          {WEEKOFF_OPTIONS.map((opt) => (
                            <Chip key={opt.key} active={dept.weekoff_days === opt.key} onClick={() => updateDept(di, { weekoff_days: opt.key })}>
                              {opt.label}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Applicable Leave Types</p>
                        <div className="flex flex-wrap gap-2">
                          {leaveTypes.map((lt, ltIdx) => (
                            <Chip key={ltIdx} active={dept.leave_type_indices.includes(ltIdx)} onClick={() => toggleDeptLeave(di, ltIdx)}>
                              {(lt.code || lt.name.slice(0, 3)).toUpperCase()} · {lt.name || "Unnamed"}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      <Field label="Duty Hours / Day">
                        <Input type="number" value={dept.duty_hours} onChange={(e) => updateDept(di, { duty_hours: e.target.value })} placeholder="8" />
                      </Field>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t border-gray-800">
            <button
              onClick={prev}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-400 hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button onClick={next} className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
                Next
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : "Complete Setup"}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
