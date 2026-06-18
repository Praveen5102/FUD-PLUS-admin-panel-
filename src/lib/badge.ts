export function statusToBadge(status: string) {
  if (status === "approved" || status === "active" || status === "present") return "success";
  if (status === "pending" || status === "late_login" || status === "half_day") return "warning";
  if (status === "rejected" || status === "inactive" || status === "resigned" || status === "absent") return "danger";
  return "neutral";
}
