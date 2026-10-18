import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonClass, ErrorNote } from "@/components/ui";
import { getLoginMode } from "@/lib/backend";

const errors: Record<string, string> = {
  inactive: "Ihr Benutzerkonto ist inaktiv. Bitte wenden Sie sich an die Administration.",
  no_email: "Microsoft hat keine E-Mail-Adresse für dieses Konto geliefert.",
  failed: "Die Anmeldung bei Microsoft ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function Login({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  const mode = await getLoginMode();
  // The backend's Development environment has no login: go straight into the app.
  if (mode === "development") {
    redirect("/");
  }

  return (
    <>
      {message && <ErrorNote>{message}</ErrorNote>}
      {mode === "microsoft" ? (
        // A plain link: the backend redirects the browser to Microsoft.
        <a href="/api/auth/login?returnUrl=/" className={`${buttonClass("primary")} w-full`}>
          Mit Microsoft anmelden
        </a>
      ) : (
        <ErrorNote>Die Anmeldung ist nicht eingerichtet: In der .env fehlen die Entra-Werte.</ErrorNote>
      )}
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main id="inhalt" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-action text-[13px] font-bold tracking-[-0.02em] text-on-action"
          >
            BV
          </span>
          <div>
            <h1 className="text-base leading-tight font-semibold">bandvcard</h1>
            <p className="text-xs text-muted">Digitale Visitenkartenverwaltung</p>
          </div>
        </div>
        <p className="text-muted">Melden Sie sich mit Ihrem Microsoft-Konto an.</p>
        <div className="flex flex-col gap-3">
          <Suspense>
            <Login searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
