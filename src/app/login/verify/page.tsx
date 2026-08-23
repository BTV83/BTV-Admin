import { redirect } from "next/navigation";
import { requirePendingSession } from "@/lib/auth";
import { CodeForm } from "../CodeForm";
import { verifyTotpAction } from "../actions";

export const metadata = { title: "Vérification — BTV Admin" };

export default async function VerifyPage() {
  const session = await requirePendingSession();
  if (!session.admin.totp_enrolled_at) redirect("/login/enroll");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Vérification en deux étapes</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Saisissez le code affiché par votre application d’authentification.
      </p>
      <CodeForm action={verifyTotpAction} submitLabel="Se connecter" />
    </main>
  );
}
