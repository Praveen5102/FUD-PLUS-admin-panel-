import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Eye, EyeOff, LogIn, Smartphone } from "lucide-react";
import logo from "../../assets/logo.png";

export default function LoginPage() {
  const { signIn, blocked, dismissBlocked } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-gradient-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="FUD Plus" className="w-14 h-14 rounded-xl object-cover mx-auto mb-3 shadow-lg shadow-indigo-900/40" />
          <h1 className="text-2xl font-bold text-gray-100">FUD Plus</h1>
          <p className="text-sm text-gray-400 mt-1">HRMS Admin Panel</p>
        </div>

        {/* Form */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@company.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={16} />
                  Sign in
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          New company?{" "}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Register your company
          </Link>
        </p>
      </div>

      {/* Account has no recognized role assigned */}
      {blocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismissBlocked} />
          <div className="relative w-full max-w-sm glass-card rounded-2xl p-7 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto mb-4">
              <Smartphone size={26} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-100 mb-2">Account Not Set Up</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              Your account doesn't have a role assigned yet. Contact your company admin to get access.
            </p>
            <button
              onClick={dismissBlocked}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
