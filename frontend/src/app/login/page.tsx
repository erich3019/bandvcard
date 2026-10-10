import { Suspense } from "react";

const errors: Record<string, string> = {
  inactive: "Ihr Benutzerkonto ist inaktiv. Bitte wenden Sie sich an die Administration.",
  no_email: "Microsoft hat keine E-Mail-Adresse für dieses Konto geliefert.",
  failed: "Die Anmeldung bei Microsoft ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function LoginError({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {message}
    </p>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight">bandvcard</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Digitale Visitenkartenverwaltung</p>
      <Suspense>
        <LoginError searchParams={searchParams} />
      </Suspense>
      {/* A plain link: the backend redirects the browser to Microsoft. */}
      <a
        href="/api/auth/login?returnUrl=/"
        className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background"
      >
        Mit Microsoft anmelden
      </a>
    </main>
  );
}
