import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { backendFetch } from "@/lib/backend";
import { type Contact, isContactId } from "@/lib/contacts";
import { ContactDetail } from "./contact-detail";

export const metadata: Metadata = { title: "Kontakt – bandvcard" };

async function LoadedContact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The ID goes into the OData URL, so anything that is not a GUID is rejected first.
  if (!isContactId(id)) {
    notFound();
  }

  const response = await backendFetch(`/api/Contacts(${id})`);
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for contact ${id}`);
  }
  const contact: Contact = await response.json();

  return <ContactDetail contact={contact} />;
}

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageShell title="Kontakt">
      <Link href="/kontakte" className="-mt-4 text-sm text-zinc-600 underline dark:text-zinc-400">
        Zur Kontaktliste
      </Link>
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Lädt …</p>}>
        <LoadedContact params={params} />
      </Suspense>
    </PageShell>
  );
}
