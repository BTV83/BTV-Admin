"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  fields: Record<string, string>;
  /** Reveals a required motive box before the action can be submitted. */
  requiresReason?: boolean;
  /** Extra free-text input, e.g. retyping a username to confirm a deletion. */
  confirmField?: { name: string; placeholder: string };
  danger?: boolean;
};

const initial: ActionState = {};

export function ActionForm({
  action,
  label,
  fields,
  requiresReason,
  confirmField,
  danger,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [open, setOpen] = useState(false);
  const expandable = requiresReason || !!confirmField;

  const button = `rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
    danger
      ? "bg-red-600 text-white hover:bg-red-700"
      : "border border-neutral-300 hover:bg-neutral-50"
  }`;

  // Ask for a motive first: it is written to the audit log and to the
  // resolution notes, so acting without one loses the reasoning permanently.
  if (expandable && !open) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" className={button} onClick={() => setOpen(true)}>
          {label}
        </button>
        {state.ok && <Feedback ok>{state.ok}</Feedback>}
        {state.error && <Feedback>{state.error}</Feedback>}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {requiresReason && (
        <textarea
          name="reason"
          required
          rows={2}
          autoFocus
          placeholder="Motif (conservé dans le journal d’audit)"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
      )}

      {confirmField && (
        <input
          name={confirmField.name}
          required
          placeholder={confirmField.placeholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-600"
        />
      )}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={button}>
          {pending ? "…" : label}
        </button>
        {expandable && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            Annuler
          </button>
        )}
      </div>

      {state.ok && <Feedback ok>{state.ok}</Feedback>}
      {state.error && <Feedback>{state.error}</Feedback>}
    </form>
  );
}

function Feedback({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <p role="status" className={`text-xs ${ok ? "text-green-700" : "text-red-600"}`}>
      {children}
    </p>
  );
}
