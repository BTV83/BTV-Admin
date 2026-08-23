import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Connexion — BTV Admin" };

export default async function LoginPage() {
  const session = await getSession();
  if (session && !session.mfaPending) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">BTV Admin</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Accès réservé. Ce compte est distinct de votre compte sur l’application.
      </p>
      <LoginForm />
    </main>
  );
}
