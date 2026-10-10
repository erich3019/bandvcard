import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { backendFetch } from "@/lib/backend";
import { CONTACTS_PAGE_SIZE, type ContactSummary, contactListQuery, displayName } from "@/lib/contacts";

export const metadata: Metadata = { title: "Kontakte – bandvcard" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function pageHref(search: string, page: number): string {
  const params = new URLSearchParams();
  if (search) {
    params.set("q", search);
  }
  if (page > 1) {
    params.set("seite", String(page));
  }
  const query = params.toString();
  return query ? `/kontakte?${query}` : "/kontakte";
}

async function ContactList({ searchParams }: { searchParams: SearchParams }) {
  const { q, seite } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const page = Math.max(1, Number.parseInt(typeof seite === "string" ? seite : "1", 10) || 1);

  const response = await backendFetch(`/api/Contacts?${contactListQuery(search, page)}`);
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for the contact list`);
  }
  const data: { "@odata.count": number; value: ContactSummary[] } = await response.json();
  const total = data["@odata.count"];
  const pages = Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE));

  return (
    <>
      {/* A plain GET form: the search text lives in the URL, so results can be bookmarked. */}
      <form action="/kontakte" className="flex gap-3">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Name, Firma, Ort oder E-Mail"
          aria-label="Kontakte durchsuchen"
          className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-900"
        />
        <button type="submit" className="rounded-full bg-foreground px-5 font-medium text-background">
          Suchen
        </button>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {total === 1 ? "1 Kontakt" : `${total} Kontakte`}
        {search && (
          <>
            {" "}
            für „{search}“ ·{" "}
            <Link href="/kontakte" className="underline">
              Suche zurücksetzen
            </Link>
          </>
        )}
      </p>

      {data.value.length === 0 ? (
        <p>
          {search ? "Keine Kontakte gefunden." : "Noch keine Kontakte vorhanden."}{" "}
          <Link href="/erfassen" className="underline">
            Visitenkarte erfassen
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
          {data.value.map((contact) => (
            <li key={contact.id}>
              <Link href={`/kontakte/${contact.id}`} className="block px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10">
                <span className="font-medium">{displayName(contact)}</span>
                {contact.abacusStatus === "ToImport" && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                    Abacus: übernehmen
                  </span>
                )}
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  {[contact.function, contact.companyName, contact.city].filter(Boolean).join(" · ")}
                </span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  {[contact.email, contact.phone, contact.mobile].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Seiten" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(search, page - 1)} className="underline">
              Zurück
            </Link>
          ) : (
            <span />
          )}
          <span>
            Seite {page} von {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(search, page + 1)} className="underline">
              Weiter
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

export default function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PageShell title="Kontakte">
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Lädt …</p>}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
