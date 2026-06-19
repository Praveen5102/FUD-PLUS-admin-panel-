export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  name: "super_admin" | "admin" | "manager" | "employee";
  description: string | null;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Shift {
  id: string;
  company_id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_night_shift: boolean;
  description: string | null;
  is_active: boolean;
}

export interface LeaveType {
  id: string;
  company_id: string;
  department_id: string | null;
  name: string;
  code: string;
  days_per_year: number;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
}

export interface Profile {
  id: string;
  company_id: string;
  department_id: string | null;
  role_id: string | null;
  auth_user_id: string | null;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  profile_image: string | null;
  joining_date: string | null;
  status: "active" | "inactive" | "resigned";
  is_first_login: boolean;
  last_login_at: string | null;
  created_at: string;
  // Joined relations
  departments?: Department;
  user_roles?: UserRole;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number | null;
  attendance_status: "present" | "absent" | "half_day" | "late_login" | "leave" | null;
  attendance_mode: "office" | "remote" | "field" | "client_visit" | "business_trip" | null;
  reason: string | null;
  check_in_selfie: string | null;
  check_out_selfie: string | null;
  created_at: string;
  // Joined
  profiles?: Pick<Profile, "full_name" | "employee_id" | "departments">;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  admin_note: string | null;
  created_at: string;
  // Joined
  profiles?: Pick<Profile, "full_name" | "employee_id" | "departments">;
  leave_types?: Pick<LeaveType, "name" | "code">;
}

export interface RemoteRequest {
  id: string;
  employee_id: string;
  request_type: "remote_work" | "client_visit" | "business_trip" | "other";
  from_date: string;
  to_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  admin_note: string | null;
  created_at: string;
  selfie_url?: string | null;
  request_latitude?: number | null;
  request_longitude?: number | null;
  is_attendance_request?: boolean;
  profiles?: Pick<Profile, "full_name" | "employee_id" | "departments">;
}

export interface Broadcast {
  id: string;
  company_id: string;
  type: "global" | "department" | "emergency" | "event";
  title: string;
  message: string;
  target_department_id: string | null;
  created_by: string | null;
  is_pinned: boolean;
  expires_at: string | null;
  created_at: string;
  departments?: Pick<Department, "name">;
  profiles?: Pick<Profile, "full_name">;
}

export interface Holiday {
  id: string;
  company_id: string;
  title: string;
  holiday_date: string;
  holiday_type: "public" | "company" | "optional";
  is_active: boolean;
  description: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "employee_id">;
}

export interface AuthUser {
  profile: Profile;
  role: UserRole["name"];
}
