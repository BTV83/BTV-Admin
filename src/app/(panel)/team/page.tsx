import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { when } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SelectForm } from "@/components/SelectForm";
import { CreateAdminForm } from "./CreateAdminForm";
import { resetAdminTotp, setAdminDisabled, setAdminRole } from "@/actions/team";

export const metadata = { title: "Équipe — BTV Admin" };

type AdminRow = {
  id: string;
  email: string;
  role: string;
  disabled_at: string | null;
  totp_enrolled_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

const ROLE_OPTIONS = [
  { value: "superadmin", label: "Superadmin" },
  { value: "moderator", label: "Modérateur" },
  { value: "support", label: "Support" },
];

export default async function TeamPage() {
  const { admin } = await requireAdmin("manage_team");

  const { data, error } = await db
    .from("admin_users")
    .select("id, email, role, disabled_at, totp_enrolled_at, last_login_at, created_at")
    .order("created_at", { ascending: true })
    .returns<AdminRow[]>();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Équipe</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Ces comptes sont indépendants de l’application mobile. Chacun configure son
        authentificateur à sa première connexion et n’accède à aucune donnée avant.
      </p>

      <section className="mb-8 rounded-xl border border-neutral-200 p-5">
        <h2 className="mb-3 text-sm font-semibold">Ajouter un administrateur</h2>
        <CreateAdminForm />
      </section>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="flex flex-col gap-3">
        {data?.map((row) => (
          <article key={row.id} className="rounded-xl border border-neutral-200 p-4">
            <header className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium">{row.email}</span>
              {row.id === admin.id && (
                <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs">vous</span>
              )}
              {row.disabled_at && (
                <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                  Désactivé
                </span>
              )}
              {!row.totp_enrolled_at && (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  2FA non configurée
                </span>
              )}
              <span className="ml-auto text-xs text-neutral-500">
                Dernière connexion : {when(row.last_login_at)}
              </span>
            </header>

            <div className="flex flex-wrap items-end gap-4">
              <SelectForm
                action={setAdminRole}
                label="Rôle"
                name="role"
                value={row.role}
                fields={{ adminId: row.id }}
                options={ROLE_OPTIONS}
              />

              {row.id !== admin.id && (
                <ActionForm
                  action={setAdminDisabled}
                  label={row.disabled_at ? "Réactiver" : "Désactiver"}
                  fields={{ adminId: row.id, disabled: String(!row.disabled_at) }}
                  danger={!row.disabled_at}
                />
              )}

              {row.totp_enrolled_at && (
                <ActionForm
                  action={resetAdminTotp}
                  label="Réinitialiser la 2FA"
                  fields={{ adminId: row.id }}
                  requiresReason
                />
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
