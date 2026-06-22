import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Mail, Phone, Calendar, CreditCard, Landmark, MapPin, UserRound, Cake, Lock, LogOut } from "lucide-react";

export default function EmployeeProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const profile = user?.profile;
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  async function handleChangePassword() {
    setError("");
    if (!newPassword || !confirmPassword) { setError("Please fill all fields."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (newPassword.length < 6) { setError("Minimum 6 characters required."); return; }
    setUpdating(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
      setShowPasswordModal(false);
      setNewPassword(""); setConfirmPassword("");
      alert("Password updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  if (!profile) return null;

  const initials = profile.full_name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—");
  const roleLabel = profile.user_roles?.name === "hr" ? "HR" : profile.user_roles?.name === "manager" ? "Manager" : "Employee";

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-6">
        {profile.profile_image ? (
          <img src={profile.profile_image} alt={profile.full_name} className="w-24 h-24 rounded-2xl object-cover border border-white/10 shadow-lg mb-3" />
        ) : (
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg mb-3 bg-linear-to-br from-indigo-500 to-blue-500">
            {initials}
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-100">{profile.full_name}</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-indigo-500/20 text-indigo-300">{roleLabel}</span>
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide ${profile.status === "active" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>{profile.status}</span>
        </div>
        {profile.joining_date && <p className="text-xs text-gray-500 mt-2">Member since {new Date(profile.joining_date).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>}
      </div>

      {/* Account details */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Account Details</h2>
      <div className="glass-card rounded-2xl p-4 mb-6 space-y-3">
        <Row icon={<Mail size={15} className="text-indigo-400" />} label="Email" value={profile.email} />
        <Row icon={<Phone size={15} className="text-green-400" />} label="Phone" value={profile.phone || "—"} />
        <Row icon={<CreditCard size={15} className="text-yellow-400" />} label="Employee ID" value={profile.employee_id} />
        <Row icon={<Calendar size={15} className="text-purple-400" />} label="Department" value={profile.departments?.name || "—"} />
      </div>

      {/* Personal & KYC */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal & KYC</h2>
      <div className="glass-card rounded-2xl p-4 mb-6 space-y-3">
        <Row icon={<Cake size={15} className="text-yellow-400" />} label="Date of Birth" value={fmtDate(profile.dob)} />
        <Row icon={<CreditCard size={15} className="text-indigo-400" />} label="Aadhar Number" value={profile.aadhar_number || "—"} />
        <Row icon={<CreditCard size={15} className="text-purple-400" />} label="PAN Number" value={profile.pan_number || "—"} />
      </div>

      {/* Bank Details */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bank Details</h2>
      <div className="glass-card rounded-2xl p-4 mb-6 space-y-3">
        <Row icon={<Landmark size={15} className="text-green-400" />} label="Account Number" value={profile.bank_account_number ? `•••• ${profile.bank_account_number.slice(-4)}` : "—"} />
        <Row icon={<Landmark size={15} className="text-indigo-400" />} label="IFSC Code" value={profile.ifsc_code || "—"} />
        <Row icon={<Landmark size={15} className="text-yellow-400" />} label="Bank Name" value={profile.bank_name || "—"} />
      </div>

      {/* Emergency Contact */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Emergency Contact</h2>
      <div className="glass-card rounded-2xl p-4 mb-6 space-y-3">
        <Row icon={<UserRound size={15} className="text-pink-400" />} label="Name" value={profile.emergency_contact_name || "—"} />
        <Row icon={<Phone size={15} className="text-green-400" />} label="Phone" value={profile.emergency_contact_phone || "—"} />
        <Row icon={<UserRound size={15} className="text-purple-400" />} label="Relation" value={profile.emergency_contact_relation || "—"} />
      </div>

      {/* Permanent Address */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Permanent Address</h2>
      <div className="glass-card rounded-2xl p-4 mb-6">
        <Row icon={<MapPin size={15} className="text-indigo-400" />} label="Address" value={
          [profile.permanent_address_line1, profile.permanent_address_line2, profile.permanent_city, profile.permanent_state, profile.permanent_pincode].filter(Boolean).join(", ") || "—"
        } />
      </div>

      {/* Preferences */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preferences</h2>
      <div className="glass-card rounded-2xl p-2 mb-6">
        <button onClick={() => setShowPasswordModal(true)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors text-left">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center"><Lock size={15} className="text-indigo-400" /></div>
          <span className="text-sm font-medium text-gray-200 flex-1">Change Password</span>
        </button>
        <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors text-left">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center"><LogOut size={15} className="text-red-400" /></div>
          <span className="text-sm font-medium text-red-400 flex-1">Sign Out</span>
        </button>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)} />
          <div className="relative w-full max-w-sm glass-card rounded-2xl p-6">
            <h2 className="font-semibold text-gray-100 mb-4">Change Password</h2>
            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <div className="space-y-3">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleChangePassword} disabled={updating} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
                {updating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-200 truncate">{value}</p>
      </div>
    </div>
  );
}
