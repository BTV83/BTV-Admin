import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { requirePendingSession } from "@/lib/auth";
import { totpUri } from "@/lib/totp";
import { CodeForm } from "../CodeForm";
import { beginEnrollment, confirmEnrollmentAction } from "../actions";

export const metadata = { title: "Configuration 2FA — BTV Admin" };

export default async function EnrollPage() {
  const session = await requirePendingSession();
  if (session.admin.totp_enrolled_at) redirect("/login/verify");

  const secret = await beginEnrollment(session.admin.id);
  const qr = await QRCode.toDataURL(totpUri(session.admin.email, secret), {
    margin: 1,
    width: 220,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">Configurer la double authentification</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Scannez ce QR code avec Google Authenticator, 1Password ou équivalent, puis
        saisissez le code affiché pour confirmer.
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element -- data URL, no optimisation wanted */}
      <img
        src={qr}
        alt="QR code de configuration"
        width={220}
        height={220}
        className="mb-4 self-center rounded-lg border border-neutral-200"
      />

      <details className="mb-6">
        <summary className="cursor-pointer text-sm text-neutral-500">
          Impossible de scanner ?
        </summary>
        <code className="mt-2 block break-all rounded-lg bg-neutral-100 p-3 text-xs">
          {secret}
        </code>
      </details>

      <CodeForm action={confirmEnrollmentAction} submitLabel="Confirmer" />
    </main>
  );
}
