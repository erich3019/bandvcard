"use client";

import { Contact, House, LogOut, Menu, Monitor, Moon, ScanLine, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const navigation = [
  { href: "/", label: "Start", icon: House },
  { href: "/kontakte", label: "Kontakte", icon: Contact },
  { href: "/erfassen", label: "Visitenkarte erfassen", icon: ScanLine },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Without a pathname (while it streams in) no entry is marked as active.
export function NavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col gap-0.5 px-3 py-4 text-[13px]">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center gap-3 rounded-md px-3 ${
              active
                ? "bg-sidebar-active font-medium text-sidebar-ink-strong"
                : "text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-ink-strong"
            }`}
          >
            <Icon aria-hidden="true" className={`size-4 ${active ? "text-sidebar-marker" : ""}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Below 1024px the sidebar becomes a drawer opened from the topbar.
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Navigation öffnen"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-ml-2 inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-divider lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            // Following a link closes the drawer, also when it leads to the current page.
            onClick={(event) => (event.target as Element).closest("a") && setOpen(false)}
            className="absolute inset-y-0 left-0 flex w-[248px] max-w-[85vw] flex-col bg-sidebar-bg text-sidebar-ink-strong shadow-xl"
          >
            <button
              type="button"
              aria-label="Navigation schliessen"
              autoFocus
              onClick={() => setOpen(false)}
              className="absolute top-3.5 right-3 inline-flex size-9 items-center justify-center rounded-md text-sidebar-ink hover:bg-sidebar-hover"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}

// Reads the pathname, so on dynamic routes it must sit inside a <Suspense> boundary.
export function NavLinks() {
  return <NavList pathname={usePathname()} />;
}

const themes = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const noSubscription = () => () => {};

// The chosen theme is only known in the browser (next-themes keeps it in localStorage).
function useMounted(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

export function UserMenu({
  name,
  email,
  initials,
  loginRequired,
}: {
  name: string;
  email: string;
  initials: string;
  loginRequired: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-label="Benutzermenü"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-30 w-64 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-xs text-muted">{email}</p>
          <div className="my-3 border-t border-divider" />
          <p id="darstellung" className="mb-2 text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
            Darstellung
          </p>
          <div
            role="group"
            aria-labelledby="darstellung"
            className="flex rounded-md border border-border bg-surface p-0.5"
          >
            {themes.map(({ value, label, icon: Icon }) => {
              const pressed = mounted && theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setTheme(value)}
                  className={`inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-sm text-xs font-medium ${
                    pressed ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-3" />
                  {label}
                </button>
              );
            })}
          </div>
          {loginRequired && (
            <>
              <div className="my-3 border-t border-divider" />
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-[13px] text-ink-secondary hover:bg-page"
                >
                  <LogOut aria-hidden="true" className="size-3.5 text-muted" />
                  Abmelden
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
