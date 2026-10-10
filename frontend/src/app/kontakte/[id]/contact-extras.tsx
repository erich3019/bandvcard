"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createOpportunity, deleteOpportunity, SessionExpiredError, setAbacusStatus } from "@/lib/api";
import { abacusStatusLabels, type Contact, OPPORTUNITY_MAX_LENGTH } from "@/lib/contacts";
import {
  appendDictation,
  createSpeechRecognition,
  readSpeechResult,
  speechErrorMessage,
  type SpeechRecognitionLike,
} from "@/lib/dictation";

// Fixed time zone, so server and browser render the same text.
const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });
const dateTime = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

// What belongs to a contact beyond the card data: its opportunities and the release for Abacus.
export function ContactExtras({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dictation: what is being said right now, shown until the recogniser settles on it.
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const opportunities = contact.opportunities ?? [];

  // Leaving the page ends a running dictation.
  useEffect(() => () => recognition.current?.abort(), []);

  function toggleDictation() {
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const speech = createSpeechRecognition("de-DE");
    if (!speech) {
      setError("Dieser Browser unterstützt keine Spracheingabe. Sie funktioniert in Chrome, Edge und Safari.");
      return;
    }

    setError(null);
    speech.onresult = (event) => {
      const spoken = readSpeechResult(event);
      if (spoken.final) {
        setText((current) => appendDictation(current, spoken.final, OPPORTUNITY_MAX_LENGTH));
      }
      setInterim(spoken.interim);
    };
    speech.onerror = (event) => {
      const message = speechErrorMessage(event.error);
      if (message) {
        setError(message);
      }
    };
    speech.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim("");
    };
    recognition.current = speech;
    setListening(true);
    speech.start();
  }
  const status = contact.abacusStatus;

  async function run(action: () => Promise<void>, failure: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
      // Reloads the server-rendered contact with its opportunities and status.
      router.refresh();
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

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      await createOpportunity(contact.id, text);
      setText("");
    }, "Opportunity konnte nicht gespeichert werden");
  }

  return (
    <div className="flex flex-col gap-8 border-t border-black/10 pt-8 dark:border-white/15">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Opportunities</h2>
        {opportunities.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Noch keine Opportunities erfasst.</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
            {opportunities.map((opportunity) => (
              <li key={opportunity.id} className="flex items-start gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words">{opportunity.text}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {date.format(new Date(opportunity.createdAt))} · {opportunity.createdBy}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Diese Opportunity wirklich löschen?")) {
                      void run(() => deleteOpportunity(opportunity.id), "Löschen fehlgeschlagen");
                    }
                  }}
                  className="text-sm text-red-800 underline disabled:opacity-50 dark:text-red-300"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Neue Opportunity
            <textarea
              value={text}
              maxLength={OPPORTUNITY_MAX_LENGTH}
              rows={2}
              required
              disabled={busy}
              onChange={(event) => setText(event.target.value)}
              className="rounded-lg border border-black/15 bg-white px-3 py-2 text-base dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
          {listening && (
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
              {interim ? `… ${interim}` : "Sprechen Sie jetzt …"}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {text.length} / {OPPORTUNITY_MAX_LENGTH} Zeichen
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy || (!listening && text.length >= OPPORTUNITY_MAX_LENGTH)}
                aria-pressed={listening}
                onClick={toggleDictation}
                className={
                  listening
                    ? "h-10 rounded-full bg-red-700 px-5 font-medium text-white"
                    : "h-10 rounded-full border border-black/10 px-5 disabled:opacity-50 dark:border-white/20"
                }
              >
                {listening ? "Aufnahme beenden" : "Diktieren"}
              </button>
              <button
                type="submit"
                disabled={busy || listening || text.trim() === ""}
                className="h-10 rounded-full bg-foreground px-5 font-medium text-background disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">ERP-Import (Abacus)</h2>
        <p>
          Status:{" "}
          {status === "None" ? (
            <span className="text-zinc-600 dark:text-zinc-400">{abacusStatusLabels.None}</span>
          ) : (
            <strong>{abacusStatusLabels[status]}</strong>
          )}
          {status === "Imported" && contact.abacusImportedAt && (
            <> am {dateTime.format(new Date(contact.abacusImportedAt))}</>
          )}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {status === "None" && "Nur freigegebene Kontakte werden nach Abacus übernommen."}
          {status === "ToImport" && "Der Kontakt wird beim nächsten Lauf des Imports nach Abacus übernommen."}
          {status === "Imported" &&
            "Der Import hat den Kontakt nach Abacus übernommen. Eine erneute Freigabe überträgt ihn noch einmal."}
        </p>
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => setAbacusStatus(contact.id, status === "ToImport" ? "None" : "ToImport"),
                "Status konnte nicht geändert werden",
              )
            }
            className={
              status === "None"
                ? "h-12 rounded-full bg-foreground px-6 font-medium text-background disabled:opacity-50"
                : "h-12 rounded-full border border-black/10 px-6 disabled:opacity-50 dark:border-white/20"
            }
          >
            {status === "None" && "Für Abacus freigeben"}
            {status === "ToImport" && "Freigabe zurücknehmen"}
            {status === "Imported" && "Erneut freigeben"}
          </button>
        </div>
      </section>
    </div>
  );
}
