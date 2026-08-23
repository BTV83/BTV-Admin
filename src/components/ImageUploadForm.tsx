"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/types";

const initial: ActionState = {};

/**
 * Separate from ActionForm because a file input needs multipart encoding and
 * cannot be expressed as a hidden string field.
 */
export function ImageUploadForm({
  action,
  fields,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <input
        type="file"
        name="image"
        accept="image/jpeg,image/png,image/webp"
        required
        className="text-sm file:mr-3 file:rounded-lg file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium"
      />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? "Envoi…" : "Téléverser"}
        </button>
        <span className="text-xs text-neutral-500">JPEG, PNG ou WebP · 5 Mo max</span>
      </div>

      {state.ok && <p className="text-xs text-green-700">{state.ok}</p>}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
