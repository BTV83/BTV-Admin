import Link from "next/link";

/** Tab strip driven by the URL, so each tab is a real, linkable page. */
export function Tabs({
  tabs,
  current,
}: {
  tabs: { href: string; label: string; key: string }[];
  current: string;
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab.key === current
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
