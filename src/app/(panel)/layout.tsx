import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { can, type Permission } from "@/lib/types";
import { LogoutButton } from "@/components/LogoutButton";

const NAV: { href: string; label: string; permission?: Permission }[] = [
  { href: "/", label: "Tableau de bord" },
  { href: "/moderation", label: "Modération", permission: "moderate" },
  { href: "/users", label: "Utilisateurs", permission: "manage_users" },
  { href: "/content", label: "Contenus", permission: "moderate" },
  { href: "/cities", label: "Communes", permission: "manage_cities" },
  { href: "/audit", label: "Journal", permission: "view_audit" },
  { href: "/team", label: "Équipe", permission: "manage_team" },
];

/**
 * Shell for every authenticated page. requireAdmin() here covers the whole
 * group, and each page calls it again with its own permission — the nav is only
 * a convenience, never the thing that keeps a role out of a section.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const links = NAV.filter((l) => !l.permission || can(admin.role, l.permission));

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-neutral-500 sm:inline">
              {admin.email} · {admin.role}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
