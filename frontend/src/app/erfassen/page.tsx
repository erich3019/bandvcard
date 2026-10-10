import type { Metadata } from "next";
import Link from "next/link";
import { CaptureForm } from "./capture-form";

export const metadata: Metadata = { title: "Visitenkarte erfassen – bandvcard" };

export default function CapturePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Visitenkarte erfassen</h1>
        <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          Zur Startseite
        </Link>
      </header>
      <CaptureForm />
    </main>
  );
}
