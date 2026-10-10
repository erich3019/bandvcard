import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

async function Welcome() {
  const user = await getCurrentUser();
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  return (
    <>
      <p className="text-zinc-600 dark:text-zinc-400">Angemeldet als {name}</p>
      <Link
        href="/erfassen"
        className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background"
      >
        Visitenkarte erfassen
      </Link>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="rounded-full border border-black/10 px-5 py-2 dark:border-white/20">
          Abmelden
        </button>
      </form>
    </>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight">bandvcard</h1>
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Lädt …</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}
