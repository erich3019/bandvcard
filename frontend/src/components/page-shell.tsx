import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

const links = [
  { href: "/kontakte", label: "Kontakte" },
  { href: "/erfassen", label: "Erfassen" },
];

const linkStyle = "text-zinc-600 hover:underline dark:text-zinc-400";

// Asking for the user is also what protects every page in this frame: without a valid
// session, getCurrentUser() redirects to the login page.
async function Account() {
  const user = await getCurrentUser();
  return (
    <div className="ml-auto flex items-center gap-4">
      <span className="hidden text-zinc-600 sm:inline dark:text-zinc-400">{user.email}</span>
      {user.loginRequired && (
        <form action="/api/auth/logout" method="post">
          <button type="submit" className={linkStyle}>
            Abmelden
          </button>
        </form>
      )}
    </div>
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
            <Account />
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
