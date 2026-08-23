/**
 * Plain GET form — no client JavaScript. The query lands in the URL, so results
 * are shareable and the back button behaves.
 */
export function SearchBar({
  placeholder,
  defaultValue,
  hidden = {},
}: {
  placeholder: string;
  defaultValue?: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form className="mb-6 flex gap-2">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
      <button
        type="submit"
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
      >
        Rechercher
      </button>
    </form>
  );
}
