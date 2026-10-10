import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

const links = [
  { href: "/kontakte", label: "Kontakte" },
  { href: "/erfassen", label: "Erfassen" },
];

const linkStyle = "text-zinc-600 hover:underline dark:text-zinc-400";

// Only a convenience: the backend decides who may manage users.
async function AdminLinks() {
  const user = await getCurrentUser();
  if (user.role !== "Admin") {
    return null;
  }
  return (
    <Link href="/benutzer" className={linkStyle}>
      Benutzer
    </Link>
  );
}

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
            <Link key={href} href={href} className={linkStyle}>
              {label}
            </Link>
          ))}
          <Suspense>
            <AdminLinks />
          </Suspense>
        </div>
      </nav>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </>
  );
}
