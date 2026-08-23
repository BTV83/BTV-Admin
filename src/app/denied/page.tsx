import { getSession } from "@/lib/session";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata = { title: "Accès refusé — BTV Admin" };

export default async function DeniedPage() {
  const session = await getSession();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Accès refusé</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Votre rôle ({session?.admin.role ?? "inconnu"}) ne permet pas d’accéder à cette
        section.
      </p>
      <LogoutButton />
    </main>
  );
}
