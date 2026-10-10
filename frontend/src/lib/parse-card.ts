// Heuristics that turn the OCR text of a business card into contact fields.
// OCR output is noisy, so every field is a best guess that the user reviews in the form.

export type CardFields = {
  salutation: string;
  firstName: string;
  lastName: string;
  companyName: string;
  function: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
};

export const emptyCardFields: CardFields = {
  salutation: "",
  firstName: "",
  lastName: "",
  companyName: "",
  function: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  phone: "",
  email: "",
};

const LETTER = "A-Za-zÀ-ÖØ-öø-ÿ";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const WEB = /\b(www\.|https?:\/\/)/i;
const PHONE_NUMBER = /(?:\+|00)?\d[\d\s()/.-]{6,}\d/;
const PHONE_LABEL = /\b(tel(efon)?|phone|fon|t|büro|office|zentrale)\b\.?:?/i;
const MOBILE_LABEL = /\b(mobil(e)?|handy|cell|m)\b\.?:?/i;
const FAX_LABEL = /\b(tele)?fax\b/i;
const POSTAL = new RegExp(`(?:^|\\s)(?:(?:D|DE|CH|A|AT)[- ])?(\\d{4,5})\\s+([${LETTER}][${LETTER} .\\-/]*)`);
const STREET_SUFFIX =
  "stra(?:ß|ss)e|str\\.?|weg|gasse|platz|allee|ring|damm|ufer|chaussee|hof|markt|steig|pfad|graben|promenade";
const HOUSE_NUMBER = "\\d+\\s?[a-zA-Z]?(?:\\s?[-/]\\s?\\d+\\s?[a-zA-Z]?)?";
const STREET = new RegExp(`([${LETTER}][${LETTER} .\\-]*?(?:${STREET_SUFFIX}))\\s+(${HOUSE_NUMBER})(?![\\d])`, "i");
const GENERIC_STREET = new RegExp(`^([${LETTER}][${LETTER} .\\-]+?)\\s+(${HOUSE_NUMBER})$`);
const COMPANY =
  /(?:^|[\s(])(GmbH|gGmbH|mbH|AG|KG|KGaA|OHG|UG|SE|GbR|e\.\s?V\.|eG|Ltd\.?|Inc\.?|LLC|Sàrl|S\.A\.|& Co\.?|Holding|Group|Gruppe)(?=$|[\s),.])/;
const FUNCTION =
  /(geschäftsführ|vorstand|inhaber|leiter|leitung|direktor|director|manager|vertrieb|sales|einkauf|berater|consultant|ingenieur|engineer|entwickler|developer|architekt|assistent|assistant|referent|sachbearbeit|partner|head of|chief|ceo|cto|cfo|coo|president|prokurist|rechtsanw|steuerberat|marketing|account|projekt|project|techniker|meister|spezialist|specialist|analyst|officer|founder|gründer)/i;
const SALUTATION = /^(Herr|Frau)\b\.?\s*/i;
const TITLE = /^((?:Prof|Dr|Dipl|Ing|Mag|med|rer|nat|h\.\s?c|jur|phil)\.(?:-(?:Ing|Kfm|Inf|Wirt)\.)?)\s*/i;
const NAME_PARTICLES = new Set(["von", "van", "de", "der", "den", "zu", "zur", "di", "da", "le", "la"]);

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeName(segment: string): boolean {
  const words = segment.split(" ");
  if (words.length < 2 || words.length > 4 || /[\d@]/.test(segment)) {
    return false;
  }
  return words.every(
    (word) => NAME_PARTICLES.has(word) || new RegExp(`^[A-ZÀ-ÖØ-Þ][${LETTER}'’-]*$`).test(word),
  );
}

export function parseCard(text: string): CardFields {
  const fields = { ...emptyCardFields };
  // Cards often put several facts on one line, separated by commas, pipes or bullets.
  const segments = text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[,|·•]/))
    .map(clean)
    .filter(Boolean);
  const used = new Set<number>();

  segments.forEach((segment, index) => {
    const email = segment.match(EMAIL);
    if (email) {
      fields.email ||= email[0].toLowerCase();
      used.add(index);
    } else if (WEB.test(segment)) {
      used.add(index);
    }
  });

  // Phone: a landline label wins over a mobile label, which wins over an unlabelled number.
  const phones: { rank: number; number: string }[] = [];
  segments.forEach((segment, index) => {
    if (used.has(index)) {
      return;
    }
    const number = segment.match(PHONE_NUMBER);
    if (!number) {
      return;
    }
    used.add(index);
    if (FAX_LABEL.test(segment)) {
      return;
    }
    const rank = PHONE_LABEL.test(segment) ? 0 : MOBILE_LABEL.test(segment) ? 1 : 2;
    phones.push({ rank, number: clean(number[0]) });
  });
  fields.phone = phones.sort((a, b) => a.rank - b.rank)[0]?.number ?? "";

  let postalIndex = -1;
  segments.forEach((segment, index) => {
    if (used.has(index) || fields.postalCode) {
      return;
    }
    const postal = segment.match(POSTAL);
    if (postal) {
      fields.postalCode = postal[1];
      fields.city = clean(postal[2]);
      postalIndex = index;
      used.add(index);
    }
  });

  segments.forEach((segment, index) => {
    if (used.has(index) || fields.street) {
      return;
    }
    // A generic "Words 12" only counts as a street directly before the postal code.
    const street = segment.match(STREET) ?? (index === postalIndex - 1 ? segment.match(GENERIC_STREET) : null);
    if (street) {
      fields.street = clean(street[1]);
      fields.houseNumber = clean(street[2]);
      used.add(index);
    }
  });

  segments.forEach((segment, index) => {
    if (!used.has(index) && !fields.companyName && COMPANY.test(segment)) {
      fields.companyName = segment;
      used.add(index);
    }
  });

  segments.forEach((segment, index) => {
    if (used.has(index) || fields.lastName) {
      return;
    }
    let rest = segment;
    const prefixes: string[] = [];
    const salutation = rest.match(SALUTATION);
    if (salutation) {
      prefixes.push(salutation[1][0].toUpperCase() + salutation[1].slice(1).toLowerCase());
      rest = rest.slice(salutation[0].length);
    }
    for (let title = rest.match(TITLE); title; title = rest.match(TITLE)) {
      prefixes.push(title[1]);
      rest = rest.slice(title[0].length);
    }
    if (FUNCTION.test(rest) || !looksLikeName(rest)) {
      return;
    }
    const words = rest.split(" ");
    // Particles such as "von" belong to the last name.
    const lastNameStart = Math.max(
      1,
      words.findIndex((word, position) => position > 0 && NAME_PARTICLES.has(word)),
    );
    const split = words.some((word, position) => position > 0 && NAME_PARTICLES.has(word))
      ? lastNameStart
      : words.length - 1;
    fields.salutation = prefixes.join(" ");
    fields.firstName = words.slice(0, split).join(" ");
    fields.lastName = words.slice(split).join(" ");
    used.add(index);
  });

  segments.forEach((segment, index) => {
    if (!used.has(index) && !fields.function && FUNCTION.test(segment) && !/\d{3,}/.test(segment)) {
      fields.function = segment;
      used.add(index);
    }
  });

  return fields;
}
