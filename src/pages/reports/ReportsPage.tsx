import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { Download, FileText, User, Briefcase, Calendar, TrendingUp, BarChart2 } from "lucide-react";
import * as XLSX from "xlsx";
import type { Profile, Department } from "../../types";

type ExportTypeId = "full" | "employee" | "department" | "date" | "daterange" | "summary";

const EXPORT_TYPES: { id: ExportTypeId; icon: React.ReactNode; label: string; desc: string; color: string }[] = [
  { id: "full",       icon: <FileText size={18} />,    label: "Full Report",   desc: "All employees, all dates",     color: "indigo" },
  { id: "employee",   icon: <User size={18} />,        label: "By Employee",  desc: "Single employee attendance",   color: "green" },
  { id: "department", icon: <Briefcase size={18} />,   label: "By Department", desc: "One department's records",     color: "yellow" },
  { id: "date",       icon: <Calendar size={18} />,    label: "By Date",      desc: "Specific day export",           color: "purple" },
  { id: "daterange",  icon: <TrendingUp size={18} />,  label: "Date Range",   desc: "Custom from-to range",          color: "red" },
  { id: "summary",    icon: <BarChart2 size={18} />,   label: "Summary Sheet", desc: "Dept totals + KPIs only",       color: "indigo" },
];

const colorRing: Record<string, string> = {
  indigo: "border-indigo-500 bg-indigo-500/10",
  green: "border-green-500 bg-green-500/10",
  yellow: "border-yellow-500 bg-yellow-500/10",
  purple: "border-purple-500 bg-purple-500/10",
  red: "border-red-500 bg-red-500/10",
};
const colorIcon: Record<string, string> = {
  indigo: "text-indigo-400", green: "text-green-400", yellow: "text-yellow-400",
  purple: "text-purple-400", red: "text-red-400",
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [exportType, setExportType] = useState<ExportTypeId>("full");
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split("T")[0]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { if (user) fetchFilters(); }, [user]);

  async function fetchFilters() {
    const [empRes, deptRes] = await Promise.all([
      supabase.from("profiles").select("*, departments(id, name)").eq("company_id", user!.profile.company_id).order("full_name"),
      supabase.from("departments").select("*").eq("company_id", user!.profile.company_id).eq("is_active", true),
    ]);
    setEmployees((empRes.data as Profile[]) ?? []);
    setDepartments((deptRes.data as Department[]) ?? []);
  }

  const isReady = () => {
    if (exportType === "employee") return !!selectedEmployee;
    if (exportType === "department") return !!selectedDept;
    if (exportType === "date") return !!singleDate;
    if (exportType === "daterange") return !!dateFrom && !!dateTo;
    return true;
  };

  const setColWidths = (sheet: XLSX.WorkSheet) => {
    sheet["!cols"] = [
      { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
    ];
  };

  async function generateReport() {
    setGenerating(true);
    try {
      let query = supabase.from("attendance").select("*, profiles!employee_id(full_name, employee_id, departments(name))");

      if (exportType === "employee") query = query.eq("employee_id", selectedEmployee);
      if (exportType === "date") query = query.eq("attendance_date", singleDate);
      if (exportType === "daterange" || exportType === "full" || exportType === "summary" || exportType === "department") {
        query = query.gte("attendance_date", dateFrom).lte("attendance_date", dateTo);
      }

      const { data: rawRecords } = await query.order("attendance_date");
      let records = rawRecords ?? [];

      if (exportType === "department" && selectedDept) {
        records = records.filter((r: any) => r.profiles?.departments?.name === selectedDept);
      }

      if (records.length === 0) { alert("No attendance data found for the selected filters."); setGenerating(false); return; }

      const toTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
      const wb = XLSX.utils.book_new();

      if (exportType !== "summary") {
        const rows = records.map((r: any) => ({
          "Date": r.attendance_date,
          "Employee Name": r.profiles?.full_name ?? "—",
          "Employee ID": r.profiles?.employee_id ?? "—",
          "Department": r.profiles?.departments?.name ?? "—",
          "Check-In": toTime(r.check_in),
          "Check-Out": toTime(r.check_out),
          "Total Hours": r.total_hours ?? "—",
          "Mode": r.attendance_mode ?? "—",
          "Status": r.attendance_status ?? "—",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        setColWidths(ws);
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      }

      if (exportType === "full" || exportType === "department" || exportType === "summary") {
        const depts = [...new Set(records.map((r: any) => r.profiles?.departments?.name ?? "Unknown"))];
        const summaryRows = depts.map((dept) => {
          const deptRecords = records.filter((r: any) => (r.profiles?.departments?.name ?? "Unknown") === dept);
          return {
            "Department": dept,
            "Total Records": deptRecords.length,
            "Present": deptRecords.filter((r: any) => r.attendance_status === "present").length,
            "Absent": deptRecords.filter((r: any) => r.attendance_status === "absent").length,
            "Late": deptRecords.filter((r: any) => r.attendance_status === "late_login").length,
            "Avg Hours": (deptRecords.reduce((s: number, r: any) => s + (r.total_hours ?? 0), 0) / deptRecords.length).toFixed(2),
          };
        });
        const ws2 = XLSX.utils.json_to_sheet(summaryRows);
        ws2["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Summary by Department");
      }

      const label =
        exportType === "employee" ? employees.find((e) => e.id === selectedEmployee)?.full_name?.replace(/\s+/g, "_") ?? "Employee" :
        exportType === "department" ? selectedDept.replace(/\s+/g, "_") :
        exportType === "date" ? singleDate :
        exportType === "summary" ? `Summary_${dateFrom}_to_${dateTo}` :
        `${dateFrom}_to_${dateTo}`;

      XLSX.writeFile(wb, `FUDPlus_Attendance_${label}.xlsx`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <p className="text-sm text-gray-400">Export attendance data to Excel — filter by employee, department, date or download a full report</p>
      </div>

      {/* Export type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {EXPORT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setExportType(t.id)}
            className={`glass-card rounded-2xl p-5 text-left transition-colors border-2 ${
              exportType === t.id ? colorRing[t.color] : "border-transparent hover:border-white/10"
            }`}
          >
            <div className={`mb-3 ${colorIcon[t.color]}`}>{t.icon}</div>
            <p className="font-semibold text-gray-100 text-sm">{t.label}</p>
            <p className="text-xs text-gray-400 mt-1">{t.desc}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="max-w-lg glass-card rounded-2xl p-6">
        <h2 className="font-semibold text-gray-100 mb-6">Filters</h2>

        <div className="space-y-4 mb-6">
          {exportType === "employee" && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Employee *</label>
              <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
                <option value="">Select employee...</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>)}
              </select>
            </div>
          )}

          {exportType === "department" && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Department *</label>
              <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
                <option value="">Select department...</option>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          )}

          {exportType === "date" && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Date *</label>
              <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
          )}

          {(exportType === "daterange" || exportType === "full" || exportType === "summary" || exportType === "department") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">From Date</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">To Date</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          )}

          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-400">
            <p className="font-medium text-gray-300 mb-1">Included sheets:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              {exportType !== "summary" && <li>Attendance — all matching records with check-in/out times, hours, status</li>}
              {(exportType === "full" || exportType === "department" || exportType === "summary") && (
                <li>Summary by Department — totals per department</li>
              )}
            </ul>
          </div>
        </div>

        <button onClick={generateReport} disabled={generating || !isReady()}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
          {generating ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Download size={16} />
              Download Excel Report
            </>
          )}
        </button>
      </div>
    </div>
  );
}
