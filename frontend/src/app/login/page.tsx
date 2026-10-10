import { Suspense } from "react";
import { getLoginMode } from "@/lib/backend";

const errors: Record<string, string> = {
  credentials: "E-Mail-Adresse oder Passwort ist falsch.",
  inactive: "Ihr Benutzerkonto ist inaktiv. Bitte wenden Sie sich an die Administration.",
  no_email: "Microsoft hat keine E-Mail-Adresse für dieses Konto geliefert.",
  failed: "Die Anmeldung bei Microsoft ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const buttonStyle = "flex h-12 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background";
const inputStyle =
  "rounded-lg border border-black/15 bg-white px-3 py-2 text-base dark:border-white/20 dark:bg-zinc-900";

async function Login({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  const mode = await getLoginMode();

  return (
    <>
      {message && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {message}
        </p>
      )}
      {mode === "password" ? (
        // A plain form post: the backend checks the test account and sets the session cookie.
        <form action="/api/auth/login" method="post" className="flex w-full max-w-xs flex-col gap-4">
          <input type="hidden" name="returnUrl" value="/" />
          <label className="flex flex-col gap-1 text-sm">
            E-Mail
            <input type="email" name="email" required autoComplete="username" autoFocus className={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Passwort
            <input type="password" name="password" required autoComplete="current-password" className={inputStyle} />
          </label>
          <button type="submit" className={buttonStyle}>
            Anmelden
          </button>
          <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">Test-Anmeldung ohne Microsoft</p>
        </form>
      ) : mode === "microsoft" ? (
        // A plain link: the backend redirects the browser to Microsoft.
        <a href="/api/auth/login?returnUrl=/" className={buttonStyle}>
          Mit Microsoft anmelden
        </a>
      ) : (
        <p role="alert" className="max-w-sm text-center text-sm text-red-700 dark:text-red-400">
          Die Anmeldung ist nicht eingerichtet. In der .env müssen entweder die Entra-Werte oder TEST_LOGINS gesetzt
          sein.
        </p>
      )}
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight">bandvcard</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Digitale Visitenkartenverwaltung</p>
      <Suspense>
        <Login searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
