import Link from "next/link";

const links = [
  { href: "/kontakte", label: "Kontakte" },
  { href: "/erfassen", label: "Erfassen" },
];

// Common frame of the pages behind the login: navigation and a centred content column.
export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <nav className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-6 px-6 py-3 text-sm">
          <Link href="/" className="font-semibold">
            bandvcard
          </Link>
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="text-zinc-600 hover:underline dark:text-zinc-400">
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </>
  );
}
