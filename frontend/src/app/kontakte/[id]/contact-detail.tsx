"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ContactFields, contactFieldLabels } from "@/components/contact-fields";
import { Badge, buttonClass, ErrorNote, PageHeader, Panel } from "@/components/ui";
import { deleteContact, SessionExpiredError, updateContact } from "@/lib/api";
import { abacusStatusLabels, type Contact, displayName, toCardFields } from "@/lib/contacts";
import { formatDateTime } from "@/lib/format";
import { AbacusRelease, Opportunities } from "./contact-extras";

const links: Partial<Record<string, string>> = { email: "mailto:", phone: "tel:", mobile: "tel:" };

export function ContactDetail({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState(() => toCardFields(contact));
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, failure: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (actionError) {
      if (actionError instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setError(`${failure}: ${actionError instanceof Error ? actionError.message : String(actionError)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      await updateContact(contact.id, fields);
      setEditing(false);
      // Reloads the server-rendered contact, including the new audit fields.
      router.refresh();
    }, "Speichern fehlgeschlagen");
  }

  function handleDelete() {
    if (!window.confirm(`Kontakt «${displayName(contact)}» wirklich löschen?`)) {
      return;
    }
    void run(async () => {
      await deleteContact(contact.id);
      router.push("/kontakte");
      router.refresh();
    }, "Löschen fehlgeschlagen");
  }

  const name = displayName(contact);
  const lead = [contact.function, contact.companyName].filter(Boolean).join(" · ");

  const header = (
    <PageHeader
      title={name}
      lead={
        (lead || contact.abacusStatus !== "None") && (
          <span className="flex flex-wrap items-center gap-2">
            {lead}
            {contact.abacusStatus !== "None" && (
              <Badge tone={contact.abacusStatus === "ToImport" ? "warning" : "success"}>
                Abacus: {abacusStatusLabels[contact.abacusStatus]}
              </Badge>
            )}
          </span>
        )
      }
      actions={
        !editing && (
          <>
            <button type="button" disabled={busy} onClick={() => setEditing(true)} className={buttonClass("primary")}>
              <Pencil aria-hidden="true" />
              Kontakt bearbeiten
            </button>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
            <button type="button" disabled={busy} onClick={handleDelete} className={buttonClass("danger")}>
              <Trash2 aria-hidden="true" />
              {busy ? "Löscht …" : "Löschen"}
            </button>
          </>
        )
      }
    />
  );

  const details = editing ? (
    <Panel title="Kontaktangaben bearbeiten">
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <ContactFields fields={fields} disabled={busy} onChange={setFields} />
        <div className="flex flex-wrap gap-2 border-t border-divider pt-5">
          <button type="submit" disabled={busy} className={buttonClass("primary")}>
            {busy ? "Speichert …" : "Änderungen speichern"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setFields(toCardFields(contact));
              setError(null);
              setEditing(false);
            }}
            className={buttonClass("secondary")}
          >
            Abbrechen
          </button>
        </div>
      </form>
    </Panel>
  ) : (
    <Panel title="Kontaktangaben">
      <dl className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
        {contactFieldLabels.map(({ name: field, label, wide }) => {
          const value = contact[field];
          const prefix = links[field];
          return (
            <div
              key={field}
              className={`grid grid-cols-[110px_1fr] items-baseline gap-3 sm:grid-cols-[130px_1fr] ${wide ? "sm:col-span-2" : ""}`}
            >
              <dt className="text-muted">{label}</dt>
              <dd className="min-w-0 break-words">
                {!value ? (
                  <span className="text-subtle">–</span>
                ) : prefix ? (
                  <a href={`${prefix}${value}`} className="font-medium text-primary hover:underline">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );

  return (
    <>
      {header}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {details}
          <Opportunities contact={contact} />
        </div>
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-4">
          {contact.photoLink && (
            <Panel title="Visitenkarte" variant="rail">
              <a href={contact.photoLink} target="_blank" rel="noreferrer" aria-label="Foto in voller Grösse öffnen">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by the backend behind the login */}
                <img
                  src={contact.photoLink}
                  alt="Foto der Visitenkarte"
                  className="max-h-72 w-full rounded-md border border-border object-contain"
                />
              </a>
            </Panel>
          )}
          <AbacusRelease contact={contact} />
          <Panel title="Verlauf" variant="rail">
            <ul className="flex flex-col gap-3 text-[13px]">
              <li>
                <span className="block font-medium">Erfasst</span>
                <span className="block text-xs text-muted">
                  {formatDateTime(new Date(contact.createdAt))} · {contact.createdBy}
                </span>
              </li>
              <li>
                <span className="block font-medium">Zuletzt geändert</span>
                <span className="block text-xs text-muted">
                  {formatDateTime(new Date(contact.updatedAt))} · {contact.updatedBy}
                </span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
