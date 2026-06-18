import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import Layout from "./components/Layout";
import DashboardPage from "./pages/dashboard/DashboardPage";
import EmployeesPage from "./pages/employees/EmployeesPage";
import AttendancePage from "./pages/attendance/AttendancePage";
import LeavesPage from "./pages/leaves/LeavesPage";
import RemotePage from "./pages/leaves/RemotePage";
import DepartmentsPage from "./pages/departments/DepartmentsPage";
import BroadcastsPage from "./pages/broadcasts/BroadcastsPage";
import HolidaysPage from "./pages/holidays/HolidaysPage";
import ReportsPage from "./pages/reports/ReportsPage";
import SettingsPage from "./pages/settings/SettingsPage";
import EmployeeDetailPage from "./pages/employees/EmployeeDetailPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected — all under the sidebar Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="employees/:id" element={<EmployeeDetailPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leaves" element={<LeavesPage />} />
          <Route path="remote" element={<RemotePage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="broadcasts" element={<BroadcastsPage />} />
          <Route path="holidays" element={<HolidaysPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
