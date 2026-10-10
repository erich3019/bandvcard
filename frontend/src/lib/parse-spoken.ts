// Turns a dictated contact into fields. The speaker names each field before its value, in any
// order: "Vorname Andreas, Nachname Gasser, Firma Aberegg Consulting AG, Ort Bern".
// Unlike a card, speech has no layout to guess from, so the field names are what makes the
// assignment reliable. The user reviews the result in the form.

import { type CardFields, emptyCardFields } from "./parse-card";

type Target = keyof CardFields | "fullName";

// What a speaker may call each field. Several words in one entry are spoken separately
// ("Mobil Nummer"), because recognisers write compounds either way.
const FIELD_NAMES: [Target, string[]][] = [
  ["salutation", ["anrede"]],
  ["firstName", ["vorname", "vor name"]],
  ["lastName", ["nachname", "nach name", "familienname"]],
  ["fullName", ["name"]],
  ["companyName", ["firma", "firmenname", "firmen name", "unternehmen"]],
  ["function", ["funktion", "position"]],
  ["street", ["straße", "strasse", "adresse"]],
  ["houseNumber", ["hausnummer", "haus nummer", "straßennummer", "strassennummer", "nummer"]],
  ["postalCode", ["postleitzahl", "post leitzahl", "plz"]],
  ["city", ["ort", "stadt", "wohnort"]],
  ["phone", ["telefon", "telefonnummer", "telefon nummer", "festnetz", "festnetznummer"]],
  [
    "mobile",
    ["mobil", "mobilnummer", "mobil nummer", "mobiltelefon", "handy", "handynummer", "handy nummer", "natel"],
  ],
  [
    "email",
    [
      "email",
      "e-mail",
      "e mail",
      "mail",
      "emailadresse",
      "e-mail-adresse",
      "email adresse",
      "e-mail adresse",
      "e mail adresse",
      "mailadresse",
      "mail adresse",
    ],
  ],
];

// Longest names first, so "e mail adresse" wins over "e mail" and over "adresse".
const KEYWORDS = FIELD_NAMES.flatMap(([target, names]) => names.map((name) => ({ target, words: name.split(" ") }))).sort(
  (a, b) => b.words.length - a.words.length,
);

const NAME_PARTICLES = new Set(["von", "van", "de", "der", "den", "zu", "zur", "di", "da", "le", "la"]);

// A word as it is compared with field names: lower case, without the punctuation that
// recognisers put around it ("Firma:", "Bern,").
function plain(word: string): string {
  return word.toLowerCase().replace(/^[.,;:!?"„“]+|[.,;:!?"„“]+$/g, "");
}

function capitalise(text: string): string {
  return text
    .split(" ")
    .map((word) => (NAME_PARTICLES.has(word.toLowerCase()) ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

// Spoken punctuation of an email address: "gasser at aberegg minus consulting punkt ch".
const SPOKEN_EMAIL: [RegExp, string][] = [
  [/\s+(at|ät|et|klammeraffe)\s+/gi, "@"],
  [/\s+(punkt|dot)\s+/gi, "."],
  [/\s+(minus|bindestrich|strich)\s+/gi, "-"],
  [/\s+(unterstrich|underscore)\s+/gi, "_"],
];

// Cleans one dictated value for its field. Also used when a single field is dictated.
export function normalizeSpokenValue(field: keyof CardFields, spoken: string): string {
  const text = spoken
    .replace(/\s+/g, " ")
    .replace(/^[,;:\s]+|[,;:\s]+$/g, "")
    .trim();
  if (!text) {
    return "";
  }

  switch (field) {
    case "email": {
      const address = SPOKEN_EMAIL.reduce((value, [pattern, sign]) => value.replace(pattern, sign), ` ${text} `);
      return address.replace(/\s+/g, "").replace(/\.$/, "").toLowerCase();
    }
    case "phone":
    case "mobile":
      return text
        .replace(/\bplus\s*/gi, "+")
        .replace(/[^\d+\s()/-]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    case "postalCode":
      return text.replace(/[^\dA-Za-z]/g, "");
    case "firstName":
    case "lastName":
    case "city":
    case "salutation":
      return capitalise(text.replace(/\.$/, field === "salutation" ? "." : ""));
    default:
      return text.replace(/\.$/, "");
  }
}

export function parseSpokenContact(spoken: string): CardFields {
  const fields = { ...emptyCardFields };
  const words = spoken.split(/\s+/).filter(Boolean);
  const values: Partial<Record<Target, string>> = {};

  // Words before the first field name can only be the name: "Andreas Gasser, Firma …".
  let target: Target = "fullName";
  let value: string[] = [];
  const finish = () => {
    // A field named twice was corrected by the speaker: the later value wins.
    if (value.length > 0) {
      values[target] = value.join(" ");
    }
    value = [];
  };

  for (let index = 0; index < words.length; ) {
    const keyword = KEYWORDS.find(({ words: name }) => name.every((part, offset) => plain(words[index + offset] ?? "") === part));
    if (keyword) {
      finish();
      target = keyword.target;
      index += keyword.words.length;
    } else {
      value.push(words[index]);
      index++;
    }
  }
  finish();

  for (const [field, text] of Object.entries(values) as [Target, string][]) {
    if (field !== "fullName") {
      fields[field] = normalizeSpokenValue(field, text);
    }
  }

  // "Name Hans von Allmen": the last word is the last name, with its particles.
  if (values.fullName && !fields.firstName && !fields.lastName) {
    const name = normalizeSpokenValue("lastName", values.fullName).split(" ");
    let split = name.length - 1;
    while (split > 1 && NAME_PARTICLES.has(name[split - 1])) {
      split--;
    }
    fields.firstName = name.slice(0, split).join(" ");
    fields.lastName = name.slice(split).join(" ");
  } else if (values.fullName && !fields.lastName) {
    fields.lastName = normalizeSpokenValue("lastName", values.fullName);
  }

  // "Straße Thunstrasse 34" without a separate house number.
  const street = fields.street.match(/^(.*\D)\s+(\d+\s?[a-zA-Z]?)$/);
  if (street && !fields.houseNumber) {
    fields.street = street[1];
    fields.houseNumber = street[2];
  }

  return fields;
}
