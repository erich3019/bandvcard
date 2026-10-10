"use client";

import type { CardFields } from "@/lib/parse-card";

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

// The editable contact fields, shared by capturing a card and editing a contact.
export function ContactFields({
  fields,
  disabled,
  onChange,
}: {
  fields: CardFields;
  disabled: boolean;
  onChange: (fields: CardFields) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {contactFieldLabels.map(({ name, label, type, wide }) => (
        <label key={name} className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
          {label}
          <input
            type={type ?? "text"}
            value={fields[name]}
            disabled={disabled}
            onChange={(event) => onChange({ ...fields, [name]: event.target.value })}
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-base dark:border-white/20 dark:bg-zinc-900"
          />
        </label>
      ))}
    </div>
  );
}
