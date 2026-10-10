import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLoginMode } from "@/lib/backend";

const errors: Record<string, string> = {
  inactive: "Ihr Benutzerkonto ist inaktiv. Bitte wenden Sie sich an die Administration.",
  no_email: "Microsoft hat keine E-Mail-Adresse für dieses Konto geliefert.",
  failed: "Die Anmeldung bei Microsoft ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const buttonStyle = "flex h-12 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background";

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
      {message && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {message}
        </p>
      )}
      {mode === "microsoft" ? (
        // A plain link: the backend redirects the browser to Microsoft.
        <a href="/api/auth/login?returnUrl=/" className={buttonStyle}>
          Mit Microsoft anmelden
        </a>
      ) : (
        <p role="alert" className="max-w-sm text-center text-sm text-red-700 dark:text-red-400">
          Die Anmeldung ist nicht eingerichtet: In der .env fehlen die Entra-Werte.
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
