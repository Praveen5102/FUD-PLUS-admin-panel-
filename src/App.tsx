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

import EmployeeLayout from "./components/EmployeeLayout";
import EmployeeHomePage from "./pages/employee/EmployeeHomePage";
import AttendanceHistoryPage from "./pages/employee/AttendanceHistoryPage";
import EmployeeCalendarPage from "./pages/employee/EmployeeCalendarPage";
import EmployeeBroadcastsPage from "./pages/employee/EmployeeBroadcastsPage";
import BroadcastDetailPage from "./pages/employee/BroadcastDetailPage";
import EmployeeProfilePage from "./pages/employee/EmployeeProfilePage";
import NotificationsPage from "./pages/shared/NotificationsPage";

const STAFF_ROLES = ["super_admin", "admin", "hr"];

function Spinner() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}

// Mirrors the mobile app's AppNavigator: not logged in -> auth screens,
// admin/hr -> the admin web app, employee/manager -> the employee web app.
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return STAFF_ROLES.includes(user.role) ? <AdminRoutes /> : <EmployeeRoutes />;
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
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
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function EmployeeRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EmployeeLayout />}>
        <Route index element={<EmployeeHomePage />} />
        <Route path="history" element={<AttendanceHistoryPage />} />
        <Route path="calendar" element={<EmployeeCalendarPage />} />
        <Route path="broadcasts" element={<EmployeeBroadcastsPage />} />
        <Route path="broadcasts/:id" element={<BroadcastDetailPage />} />
        <Route path="profile" element={<EmployeeProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Everything else branches on auth + role */}
        <Route path="/*" element={<AuthGate />} />
      </Routes>
    </BrowserRouter>
  );
}
