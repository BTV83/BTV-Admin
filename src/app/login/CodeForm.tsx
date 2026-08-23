"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
};

const initial: FormState = {};

/** Shared by the TOTP verification and enrolment steps. */
export function CodeForm({ action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700">Code à 6 chiffres</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-2xl tracking-[0.4em] outline-none focus:border-neutral-900"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Vérification…" : submitLabel}
      </button>
    </form>
  );
}
