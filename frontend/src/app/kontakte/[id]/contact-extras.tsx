"use client";

import { Mic, MicOff, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, buttonClass, ErrorNote, inputClass, Panel } from "@/components/ui";
import { createOpportunity, deleteOpportunity, SessionExpiredError, setAbacusStatus } from "@/lib/api";
import { abacusStatusLabels, type Contact, OPPORTUNITY_MAX_LENGTH } from "@/lib/contacts";
import { appendDictation } from "@/lib/dictation";
import { formatDate, formatDateTime } from "@/lib/format";
import { useDictation } from "@/lib/use-dictation";

// Runs a change against the API, then reloads the server-rendered contact.
function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, failure: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
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

  return { busy, error, setError, run };
}

// What belongs to a contact beyond the card data: its opportunities …
export function Opportunities({ contact }: { contact: Contact }) {
  const [text, setText] = useState("");
  const { busy, error, setError, run } = useAction();
  const dictation = useDictation(setError);
  const { listening, interim } = dictation;
  const opportunities = contact.opportunities ?? [];

  function toggleDictation() {
    if (listening) {
      dictation.stop();
      return;
    }
    setError(null);
    dictation.start((spoken) => setText((current) => appendDictation(current, spoken, OPPORTUNITY_MAX_LENGTH)));
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      await createOpportunity(contact.id, text);
      setText("");
    }, "Lead konnte nicht gespeichert werden");
  }

  return (
    <Panel title="Leads" sub="Gesprächsnotizen und Chancen zu diesem Kontakt." flush className="overflow-hidden">
      {error && (
        <div className="px-5 pb-4 sm:px-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {opportunities.length === 0 ? (
        <p className="px-5 pb-5 text-muted sm:px-6">Noch keine Leads erfasst.</p>
      ) : (
        <ul className="border-t border-border">
          {opportunities.map((opportunity) => (
            <li
              key={opportunity.id}
              className="group flex items-start gap-4 border-b border-divider px-5 py-3 last:border-b-0 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words text-ink-secondary">{opportunity.text}</p>
                <p className="text-xs text-muted">
                  {formatDate(new Date(opportunity.createdAt))} · {opportunity.createdBy}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                aria-label="Lead löschen"
                onClick={() => {
                  if (window.confirm("Diesen Lead wirklich löschen?")) {
                    void run(() => deleteOpportunity(opportunity.id), "Löschen fehlgeschlagen");
                  }
                }}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-danger-bg hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-col gap-2 border-t border-border bg-page px-5 py-4 sm:px-6">
        <label htmlFor="new-opportunity" className="text-[13px] text-muted">
          Neuer Lead
        </label>
        <textarea
          id="new-opportunity"
          value={text}
          maxLength={OPPORTUNITY_MAX_LENGTH}
          rows={2}
          required
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          className={`${inputClass} h-auto py-2 text-base sm:text-[14px]`}
        />
        {listening && (
          <p role="status" className="text-xs text-muted">
            {interim ? `… ${interim}` : "Sprechen Sie jetzt …"}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted tabular-nums">
            {text.length} / {OPPORTUNITY_MAX_LENGTH} Zeichen
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || (!listening && text.length >= OPPORTUNITY_MAX_LENGTH)}
              aria-pressed={listening}
              onClick={toggleDictation}
              className={
                listening
                  ? `${buttonClass("secondary")} border-danger bg-danger text-on-danger hover:bg-danger [&>svg]:text-on-danger`
                  : buttonClass("secondary")
              }
            >
              {listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              {listening ? "Aufnahme beenden" : "Diktieren"}
            </button>
            <button type="submit" disabled={busy || listening || text.trim() === ""} className={buttonClass("secondary")}>
              <Plus aria-hidden="true" />
              Lead hinzufügen
            </button>
          </div>
        </div>
      </form>
    </Panel>
  );
}

// … and the release for the import into Abacus.
export function AbacusRelease({ contact }: { contact: Contact }) {
  const { busy, error, run } = useAction();
  const status = contact.abacusStatus;

  return (
    <Panel title="CRM-Import" variant="rail">
      <div className="flex flex-col gap-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        <p className="flex flex-wrap items-center gap-2">
          {status === "None" ? (
            <Badge>{abacusStatusLabels.None}</Badge>
          ) : (
            <Badge tone={status === "ToImport" ? "warning" : "success"}>{abacusStatusLabels[status]}</Badge>
          )}
          {status === "Imported" && contact.abacusImportedAt && (
            <span className="text-xs text-muted">am {formatDateTime(new Date(contact.abacusImportedAt))}</span>
          )}
        </p>
        <p className="text-xs text-muted">
          {status === "None" && "Nur freigegebene Kontakte werden ins CRM übernommen."}
          {status === "ToImport" && "Der Kontakt wird beim nächsten Lauf des Imports ins CRM übernommen."}
          {status === "Imported" &&
            "Der Import hat den Kontakt ins CRM übernommen. Eine erneute Freigabe überträgt ihn noch einmal."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(
              () => setAbacusStatus(contact.id, status === "ToImport" ? "None" : "ToImport"),
              "Status konnte nicht geändert werden",
            )
          }
          className={`${buttonClass("secondary")} w-full`}
        >
          {status === "None" && "Für CRM freigeben"}
          {status === "ToImport" && "Freigabe zurücknehmen"}
          {status === "Imported" && "Erneut freigeben"}
        </button>
      </div>
    </Panel>
  );
}
