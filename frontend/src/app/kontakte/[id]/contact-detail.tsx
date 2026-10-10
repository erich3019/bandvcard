"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ContactFields, contactFieldLabels } from "@/components/contact-fields";
import { deleteContact, SessionExpiredError, updateContact } from "@/lib/api";
import { type Contact, displayName, toCardFields } from "@/lib/contacts";

// Fixed time zone, so server and browser render the same text.
const dateTime = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

const links: Partial<Record<string, string>> = { email: "mailto:", phone: "tel:" };

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
    if (!window.confirm(`Kontakt „${displayName(contact)}“ wirklich löschen?`)) {
      return;
    }
    void run(async () => {
      await deleteContact(contact.id);
      router.push("/kontakte");
      router.refresh();
    }, "Löschen fehlgeschlagen");
  }

  const alert = error && (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
      {error}
    </p>
  );

  const photo = contact.photoLink && (
    <a href={contact.photoLink} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- served by the backend behind the login */}
      <img src={contact.photoLink} alt="Foto der Visitenkarte" className="max-h-72 w-full rounded-lg object-contain" />
    </a>
  );

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {alert}
        {photo}
        <ContactFields fields={fields} disabled={busy} onChange={setFields} />
        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-full bg-foreground px-6 font-medium text-background disabled:opacity-50"
          >
            {busy ? "Speichert …" : "Speichern"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setFields(toCardFields(contact));
              setError(null);
              setEditing(false);
            }}
            className="h-12 rounded-full border border-black/10 px-6 dark:border-white/20"
          >
            Abbrechen
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {alert}
      <h2 className="text-xl font-semibold">{displayName(contact)}</h2>
      {photo}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        {contactFieldLabels.map(({ name, label }) => {
          const value = contact[name];
          const prefix = links[name];
          return (
            <div key={name} className="contents">
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
              <dd>
                {!value ? (
                  <span className="text-zinc-400">–</span>
                ) : prefix ? (
                  <a href={`${prefix}${value}`} className="underline">
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
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Erfasst am {dateTime.format(new Date(contact.createdAt))} von {contact.createdBy}
        <br />
        Zuletzt geändert am {dateTime.format(new Date(contact.updatedAt))} von {contact.updatedBy}
      </p>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(true)}
          className="h-12 rounded-full bg-foreground px-6 font-medium text-background disabled:opacity-50"
        >
          Bearbeiten
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="h-12 rounded-full border border-red-700/40 px-6 text-red-800 disabled:opacity-50 dark:text-red-300"
        >
          {busy ? "Löscht …" : "Löschen"}
        </button>
      </div>
    </div>
  );
}
