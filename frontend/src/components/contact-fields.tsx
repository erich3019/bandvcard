"use client";

import { Mic, MicOff } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import type { CardFields } from "@/lib/parse-card";
import { normalizeSpokenValue } from "@/lib/parse-spoken";
import { useDictation } from "@/lib/use-dictation";
import { ErrorNote, inputClass } from "./ui";

export const contactFieldLabels: { name: keyof CardFields; label: string; type?: string; wide?: boolean }[] = [
  { name: "salutation", label: "Anrede" },
  { name: "function", label: "Funktion" },
  { name: "firstName", label: "Vorname" },
  { name: "lastName", label: "Nachname" },
  { name: "companyName", label: "Firmenname", wide: true },
  { name: "street", label: "Strasse" },
  { name: "houseNumber", label: "Strassennummer" },
  { name: "postalCode", label: "Postleitzahl" },
  { name: "city", label: "Ort" },
  { name: "phone", label: "Telefon", type: "tel" },
  { name: "mobile", label: "Mobil", type: "tel" },
  { name: "email", label: "E-Mail", type: "email" },
];

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
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
        {contactFieldLabels.map(({ name, label, type, wide }) => {
          const active = dictation.listening && dictated === name;
          return (
            <div key={name} className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
              <label htmlFor={`contact-${name}`} className="text-[13px] text-muted">
                {label}
              </label>
              <div className="flex gap-2">
                <input
                  id={`contact-${name}`}
                  type={type ?? "text"}
                  value={fields[name]}
                  disabled={disabled}
                  placeholder={active ? dictation.interim || "Sprechen Sie jetzt …" : undefined}
                  onChange={(event) => onChange((current) => ({ ...current, [name]: event.target.value }))}
                  // 16px on phones, so iOS does not zoom into the field.
                  className={`${inputClass} flex-1 text-base sm:text-[14px]`}
                />
                <button
                  type="button"
                  disabled={disabled || (dictation.listening && !active)}
                  aria-label={active ? `Aufnahme für ${label} beenden` : `${label} diktieren`}
                  aria-pressed={active}
                  onClick={() => toggleDictation(name)}
                  className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-danger bg-danger text-on-danger"
                      : "border-border bg-surface text-muted hover:bg-page hover:text-ink"
                  }`}
                >
                  {active ? <MicOff aria-hidden="true" className="size-4" /> : <Mic aria-hidden="true" className="size-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
