import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { MobileNav, NavLinks, NavList, UserMenu } from "./shell-client";

export type Crumb = { label: string; href?: string };

function fullName(user: { firstName: string | null; lastName: string | null; email: string }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function initials(user: { firstName: string | null; lastName: string | null; email: string }): string {
  const fromName = [user.firstName, user.lastName].map((part) => part?.trim()[0] ?? "").join("");
  return (fromName || user.email.slice(0, 2)).toUpperCase();
}

// Asking for the user is also what protects every page in this frame: without a valid
// session, getCurrentUser() redirects to the login page.
async function Account() {
  const user = await getCurrentUser();
  return (
    <UserMenu name={fullName(user)} email={user.email} initials={initials(user)} loginRequired={user.loginRequired} />
  );
}

async function SidebarUser() {
  const user = await getCurrentUser();
  return (
    <div className="m-3 flex items-center gap-3 rounded-lg bg-sidebar-card p-3 text-[13px]">
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-action text-[11px] font-semibold text-on-action"
      >
        {initials(user)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sidebar-ink-strong">{fullName(user)}</span>
        <small className="block text-[11px] text-sidebar-ink-muted">
          {user.role === "Admin" ? "Administration" : "Benutzer"}
        </small>
      </span>
    </div>
  );
}

function SidebarContent() {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-hover px-5">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-action text-[13px] font-bold tracking-[-0.02em] text-on-action"
        >
          BV
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] leading-tight font-semibold">bandvcard</span>
          <span className="block text-[11px] leading-tight text-sidebar-ink-muted">Visitenkarten</span>
        </span>
      </div>
      <Suspense fallback={<NavList pathname={null} />}>
        <NavLinks />
      </Suspense>
      <Suspense>
        <SidebarUser />
      </Suspense>
    </>
  );
}

// Common frame of the pages behind the login: sidebar, topbar with the path and the user menu,
// and the content area. Each page renders its own PageHeader.
export function PageShell({ crumbs, children }: { crumbs: Crumb[]; children: React.ReactNode }) {
  return (
    <>
      <a
        href="#inhalt"
        className="absolute top-4 left-4 z-50 -translate-y-[200%] rounded-md bg-surface px-4 py-2 font-medium text-ink focus:translate-y-0"
      >
        Zum Inhalt springen
      </a>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-ink-strong lg:flex">
          <SidebarContent />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4 sm:px-8">
            <MobileNav>
              <SidebarContent />
            </MobileNav>
            <nav aria-label="Pfad" className="min-w-0 flex-1">
              <ol className="flex items-center gap-2 text-[13px] text-muted">
                {crumbs.map((crumb, index) => {
                  const last = index === crumbs.length - 1;
                  return (
                    <li key={index} className={`flex min-w-0 items-center gap-2 ${last ? "" : "hidden sm:flex"}`}>
                      {index > 0 && (
                        <ChevronRight
                          aria-hidden="true"
                          className={`size-3 shrink-0 text-subtle ${last ? "hidden sm:block" : ""}`}
                        />
                      )}
                      {last || !crumb.href ? (
                        <span aria-current={last ? "page" : undefined} className="truncate font-medium text-ink">
                          {crumb.label}
                        </span>
                      ) : (
                        <Link href={crumb.href} className="truncate hover:underline">
                          {crumb.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
            <Suspense fallback={<span className="size-9 rounded-full bg-divider" />}>
              <Account />
            </Suspense>
          </header>
          <main id="inhalt" tabIndex={-1} className="flex flex-1 flex-col gap-6 px-4 pt-7 pb-10 focus:outline-none sm:px-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
