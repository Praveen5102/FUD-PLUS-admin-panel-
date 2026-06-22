import { supabase } from "./supabase";

type NotifyType = "attendance" | "leave" | "broadcast" | "system" | "alert";

export async function notifyProfile(
  profileId: string,
  title: string,
  message: string,
  type: NotifyType = "alert",
  referenceId?: string,
) {
  await supabase.functions.invoke("send-notification", {
    body: { profile_id: profileId, title, message, type, reference_id: referenceId },
  });
}

/** Notifies every admin/super_admin/hr in the given company. */
export async function notifyAdmins(
  companyId: string,
  title: string,
  message: string,
  type: NotifyType = "alert",
  referenceId?: string,
) {
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, user_roles!inner(name)")
    .eq("company_id", companyId)
    .in("user_roles.name", ["admin", "super_admin", "hr"]);

  await Promise.all(
    (admins ?? []).map((a) => notifyProfile(a.id, title, message, type, referenceId)),
  );
}
