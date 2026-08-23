"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  fields: Record<string, string>;
  label: string;
};

const initial: ActionState = {};

/** A labelled dropdown that submits on change — for role and account type. */
export function SelectForm({ action, name, value, options, fields, label }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      {Object.entries(fields).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}

      <label className="text-xs font-medium text-neutral-500">{label}</label>
      <select
        name={name}
        defaultValue={value}
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900 disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {state.ok && <p className="text-xs text-green-700">{state.ok}</p>}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
