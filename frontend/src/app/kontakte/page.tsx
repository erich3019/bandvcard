import { ChevronLeft, ChevronRight, ScanLine, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { Badge, buttonClass, captionCaps, inputClass, PageHeader, Panel } from "@/components/ui";
import { backendFetch } from "@/lib/backend";
import {
  abacusStatusLabels,
  CONTACTS_PAGE_SIZE,
  type ContactSummary,
  contactListQuery,
  displayName,
} from "@/lib/contacts";
import { formatNumber } from "@/lib/format";

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

  const first = total === 0 ? 0 : (page - 1) * CONTACTS_PAGE_SIZE + 1;
  const last = Math.min(total, page * CONTACTS_PAGE_SIZE);

  return (
    <Panel flush className="overflow-hidden">
      {/* A plain GET form: the search text lives in the URL, so results can be bookmarked. */}
      <form action="/kontakte" className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Name, Firma, Ort oder E-Mail"
            aria-label="Kontakte durchsuchen"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          Suchen
        </button>
        {search && (
          <Link href="/kontakte" className="text-[13px] font-medium text-primary hover:underline">
            Suche zurücksetzen
          </Link>
        )}
      </form>

      {data.value.length === 0 ? (
        <p className="px-6 py-8 text-muted">
          {search ? `Keine Kontakte für «${search}» gefunden.` : "Noch keine Kontakte vorhanden."}{" "}
          <Link href="/erfassen" className="font-medium text-primary hover:underline">
            Visitenkarte erfassen
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-page text-left">
                <th scope="col" className={`${captionCaps} py-2.5 pr-3 pl-4 font-medium sm:pl-6`}>
                  Name
                </th>
                <th scope="col" className={`${captionCaps} hidden px-3 py-2.5 font-medium md:table-cell`}>
                  Firma
                </th>
                <th scope="col" className={`${captionCaps} hidden px-3 py-2.5 font-medium lg:table-cell`}>
                  Ort
                </th>
                <th scope="col" className={`${captionCaps} py-2.5 pr-4 pl-3 font-medium sm:pr-6`}>
                  CRM
                </th>
              </tr>
            </thead>
            <tbody>
              {data.value.map((contact) => (
                // The name link stretches over the whole row, so the row is one target.
                <tr key={contact.id} className="relative border-b border-divider last:border-b-0 hover:bg-page">
                  <td className="py-3 pr-3 pl-4 sm:pl-6">
                    <Link
                      href={`/kontakte/${contact.id}`}
                      className="font-medium text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus-ring"
                    >
                      {displayName(contact)}
                    </Link>
                    <span className="block text-xs text-muted">
                      <span className="md:hidden">
                        {[contact.function, contact.companyName].filter(Boolean).join(" · ")}
                      </span>
                      <span className="hidden md:inline">{contact.function}</span>
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-ink-secondary md:table-cell">{contact.companyName}</td>
                  <td className="hidden px-3 py-3 text-ink-secondary lg:table-cell">{contact.city}</td>
                  <td className="py-3 pr-4 pl-3 sm:pr-6">
                    {contact.abacusStatus === "None" ? (
                      <span className="text-muted">–</span>
                    ) : (
                      <Badge tone={contact.abacusStatus === "ToImport" ? "warning" : "success"}>
                        {abacusStatusLabels[contact.abacusStatus]}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav
        aria-label="Seiten"
        className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted"
      >
        <span className="tabular-nums">
          {total === 0 ? "0 Kontakte" : `${first}–${last} von ${formatNumber(total)}`}
        </span>
        {pages > 1 && (
          <span className="flex items-center gap-1">
            {page > 1 ? (
              <Link href={pageHref(search, page - 1)} className={buttonClass("secondary", "md")}>
                <ChevronLeft aria-hidden="true" />
                Zurück
              </Link>
            ) : (
              <span aria-disabled="true" className={buttonClass("secondary", "md")}>
                <ChevronLeft aria-hidden="true" />
                Zurück
              </span>
            )}
            <span className="px-2 tabular-nums">
              Seite {page} von {pages}
            </span>
            {page < pages ? (
              <Link href={pageHref(search, page + 1)} className={buttonClass("secondary", "md")}>
                Weiter
                <ChevronRight aria-hidden="true" />
              </Link>
            ) : (
              <span aria-disabled="true" className={buttonClass("secondary", "md")}>
                Weiter
                <ChevronRight aria-hidden="true" />
              </span>
            )}
          </span>
        )}
      </nav>
    </Panel>
  );
}

export default function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PageShell crumbs={[{ label: "Start", href: "/" }, { label: "Kontakte" }]}>
      <PageHeader
        title="Kontakte"
        lead="Kontakte aus erfassten Visitenkarten, sortiert nach Nachname."
        actions={
          <Link href="/erfassen" className={buttonClass("primary")}>
            <ScanLine aria-hidden="true" />
            Visitenkarte erfassen
          </Link>
        }
      />
      <Suspense fallback={<p className="text-muted">Lädt …</p>}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
