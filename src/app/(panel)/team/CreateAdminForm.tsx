"use client";

import { useActionState } from "react";
import { createAdmin } from "@/actions/team";
import type { ActionState } from "@/lib/types";

const initial: ActionState = {};

export function CreateAdminForm() {
  const [state, formAction, pending] = useActionState(createAdmin, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="email@exemple.fr"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <select
          name="role"
          defaultValue="moderator"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        >
          <option value="moderator">Modérateur</option>
          <option value="support">Support</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Création…" : "Créer"}
        </button>
      </div>

      {/* The temporary password is shown once and never stored in clear. */}
      {state.ok && (
        <p className="rounded-lg bg-green-50 p-3 font-mono text-xs break-all text-green-900">
          {state.ok}
        </p>
      )}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
