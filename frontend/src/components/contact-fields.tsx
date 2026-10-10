"use client";

import { type Dispatch, type SetStateAction, useState } from "react";
import type { CardFields } from "@/lib/parse-card";
import { normalizeSpokenValue } from "@/lib/parse-spoken";
import { useDictation } from "@/lib/use-dictation";

export const contactFieldLabels: { name: keyof CardFields; label: string; type?: string; wide?: boolean }[] = [
  { name: "salutation", label: "Anrede" },
  { name: "function", label: "Funktion" },
  { name: "firstName", label: "Vorname" },
  { name: "lastName", label: "Nachname" },
  { name: "companyName", label: "Firmenname", wide: true },
  { name: "street", label: "Straße" },
  { name: "houseNumber", label: "Straßennummer" },
  { name: "postalCode", label: "Postleitzahl" },
  { name: "city", label: "Ort" },
  { name: "phone", label: "Telefon", type: "tel" },
  { name: "mobile", label: "Mobil", type: "tel" },
  { name: "email", label: "E-Mail", type: "email" },
];

function MicrophoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

// The editable contact fields, shared by capturing a card and editing a contact.
// Each field can also be dictated: the spoken text replaces what is in the field.
export function ContactFields({
  fields,
  disabled,
  onChange,
}: {
  fields: CardFields;
  disabled: boolean;
  onChange: Dispatch<SetStateAction<CardFields>>;
}) {
  const [dictated, setDictated] = useState<keyof CardFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dictation = useDictation(setError);

  function toggleDictation(name: keyof CardFields) {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    setError(null);
    setDictated(name);
    dictation.start((spoken) => onChange((current) => ({ ...current, [name]: normalizeSpokenValue(name, spoken) })));
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {contactFieldLabels.map(({ name, label, type, wide }) => {
          const active = dictation.listening && dictated === name;
          return (
            <div key={name} className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
              <label htmlFor={`contact-${name}`}>{label}</label>
              <div className="flex gap-2">
                <input
                  id={`contact-${name}`}
                  type={type ?? "text"}
                  value={fields[name]}
                  disabled={disabled}
                  placeholder={active ? dictation.interim || "Sprechen Sie jetzt …" : undefined}
                  onChange={(event) => onChange((current) => ({ ...current, [name]: event.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-base dark:border-white/20 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  disabled={disabled || (dictation.listening && !active)}
                  aria-label={active ? `Aufnahme für ${label} beenden` : `${label} diktieren`}
                  aria-pressed={active}
                  onClick={() => toggleDictation(name)}
                  className={
                    active
                      ? "flex w-10 items-center justify-center rounded-lg bg-red-700 text-white"
                      : "flex w-10 items-center justify-center rounded-lg border border-black/15 text-zinc-600 disabled:opacity-40 dark:border-white/20 dark:text-zinc-400"
                  }
                >
                  <MicrophoneIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
