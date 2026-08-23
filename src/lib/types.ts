export type AdminRole = "superadmin" | "moderator" | "support";

export type Admin = {
  id: string;
  email: string;
  role: AdminRole;
  totp_enrolled_at: string | null;
};

/** Return shape of every server action, consumed by <ActionForm>. */
export type ActionState = { error?: string; ok?: string };

// Who may do what. Checked server-side by requireAdmin(); the navigation just
// mirrors it. Account deletion is irreversible, so it is superadmin-only even
// though moderators can otherwise manage users.
export const PERMISSIONS = {
  superadmin: [
    "moderate",
    "manage_users",
    "delete_users",
    "manage_cities",
    "view_audit",
    "manage_team",
  ],
  moderator: ["moderate", "manage_users", "manage_cities"],
  support: [],
} as const satisfies Record<AdminRole, readonly string[]>;

export type Permission = (typeof PERMISSIONS)[AdminRole][number];

export function can(role: AdminRole, permission: Permission): boolean {
  return (PERMISSIONS[role] as readonly string[]).includes(permission);
}
