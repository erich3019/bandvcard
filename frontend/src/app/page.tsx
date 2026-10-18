import { ChevronRight, ScanLine } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { Badge, buttonClass, captionCaps, PageHeader, Panel } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";
import { abacusStatusLabels, type ContactSummary, displayName } from "@/lib/contacts";
import { formatDate, formatLongDate, formatNumber } from "@/lib/format";

const RECENT_COUNT = 5;

async function count(filter?: string): Promise<number> {
  const query = `$count=true&$top=0${filter ? `&$filter=${encodeURIComponent(filter)}` : ""}`;
  const response = await backendFetch(`/api/Contacts?${query}`);
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for the contact count`);
  }
  return (await response.json())["@odata.count"];
}

async function recentContacts(): Promise<(ContactSummary & { createdAt: string })[]> {
  const response = await backendFetch(
    `/api/Contacts?$select=id,firstName,lastName,companyName,function,city,abacusStatus,createdAt&$orderby=createdAt desc&$top=${RECENT_COUNT}`,
  );
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for the recent contacts`);
  }
  return (await response.json()).value;
}

function KpiTile({ label, value, meta, href }: { label: string; value: number; meta: string; href?: string }) {
  const content = (
    <>
      <p className={captionCaps}>{label}</p>
      <p className="mt-3 text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{formatNumber(value)}</p>
      <p className="mt-2 text-xs text-muted">{meta}</p>
    </>
  );
  const tile = "block rounded-lg border border-border bg-surface p-5";
  return href ? (
    <Link href={href} className={`${tile} hover:border-border-strong`}>
      {content}
    </Link>
  ) : (
    <div className={tile}>{content}</div>
  );
}

async function Overview() {
  const user = await getCurrentUser();
  const [total, toImport, imported, recent] = await Promise.all([
    count(),
    count("abacusStatus eq 'ToImport'"),
    count("abacusStatus eq 'Imported'"),
    recentContacts(),
  ]);
  const scope = user.role === "Admin" ? "aller Benutzer" : "von Ihnen erfasst";

  return (
    <>
      <PageHeader
        title={user.firstName ? `Guten Tag, ${user.firstName}` : "Guten Tag"}
        lead={formatLongDate(new Date())}
        actions={
          <Link href="/erfassen" className={buttonClass("primary")}>
            <ScanLine aria-hidden="true" />
            Visitenkarte erfassen
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <KpiTile label="Kontakte" value={total} meta={`Kontakte ${scope}`} href="/kontakte" />
        <KpiTile label="Für Abacus freigegeben" value={toImport} meta="werden beim nächsten Import übernommen" />
        <KpiTile label="Nach Abacus übernommen" value={imported} meta="vom Import bereits übertragen" />
      </div>

      <Panel
        title="Zuletzt erfasst"
        sub={`Die ${RECENT_COUNT} neuesten Kontakte, ${scope}.`}
        actions={
          <Link href="/kontakte" className={buttonClass("secondary", "md")}>
            Alle Kontakte
          </Link>
        }
        flush
        className="overflow-hidden"
      >
        {recent.length === 0 ? (
          <p className="px-5 pb-6 text-muted sm:px-6">
            Noch keine Kontakte vorhanden.{" "}
            <Link href="/erfassen" className="font-medium text-primary hover:underline">
              Erste Visitenkarte erfassen
            </Link>
          </p>
        ) : (
          <ul className="border-t border-border">
            {recent.map((contact) => (
              <li key={contact.id} className="border-b border-divider last:border-b-0">
                <Link
                  href={`/kontakte/${contact.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-page sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{displayName(contact)}</span>
                    <span className="block truncate text-xs text-muted">
                      {[contact.function, contact.companyName, contact.city].filter(Boolean).join(" · ") || "–"}
                    </span>
                  </span>
                  {contact.abacusStatus !== "None" && (
                    <span className="hidden sm:inline">
                      <Badge tone={contact.abacusStatus === "ToImport" ? "warning" : "success"}>
                        Abacus: {abacusStatusLabels[contact.abacusStatus]}
                      </Badge>
                    </span>
                  )}
                  <span className="hidden text-xs text-muted tabular-nums sm:inline">
                    {formatDate(new Date(contact.createdAt))}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export default function Home() {
  return (
    <PageShell crumbs={[{ label: "Start" }]}>
      <Suspense fallback={<p className="text-muted">Lädt …</p>}>
        <Overview />
      </Suspense>
    </PageShell>
  );
}
