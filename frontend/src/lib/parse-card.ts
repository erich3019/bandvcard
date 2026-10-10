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

// Collapses whitespace and drops what OCR adds at the edges of a line: stray symbols
// such as "|" or "§" read from card borders, shadows and rules.
function clean(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\d+(]+|[^\p{L}\d).]+$/gu, "")
    .trim();
}

const NAME_WORD = new RegExp(`^[A-ZÀ-ÖØ-Þ][${LETTER}'’-]+$`);

function isNameWord(word: string): boolean {
  return NAME_WORD.test(word);
}

type Name = { salutation: string; firstName: string; lastName: string };

// Splits "Herr Dr. Erika Mustermann" into salutation and titles ("Herr Dr.") and the rest.
function splitPrefixes(text: string): { prefixes: string; rest: string } {
  let rest = text;
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
  return { prefixes: prefixes.join(" "), rest };
}

// Comparable form of a name or an email part: lower case, umlauts both written out and plain.
function nameKeys(value: string): string[] {
  const lower = value.toLowerCase();
  const writtenOut = lower.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  const plain = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
  return [writtenOut, plain];
}

// The most reliable hint for the name is the email address: "gasser@…" or "erika.mustermann@…"
// names words that also stand on the card. This finds the name even in a line that OCR has
// polluted with noise or merged with the logo text.
function nameFromEmail(segment: string, email: string): Name | null {
  const parts = email
    .split("@")[0]
    .split(/[._-]+/)
    .filter((part) => part.length >= 3);
  const words = segment.split(" ");
  const matches = (word: string, part: string) => isNameWord(word) && nameKeys(word).includes(part);
  const isParticle = (word: string | undefined) => word !== undefined && NAME_PARTICLES.has(word);

  for (let index = 0; index < words.length; index++) {
    const part = parts.find((candidate) => matches(words[index], candidate));
    if (!part) {
      continue;
    }

    let first = index;
    let lastStart = index;
    let lastEnd = index;
    const isFirstName = parts.length > 1 && part === parts[0];
    if (!isFirstName) {
      // The match is the last name: particles and the first name stand before it.
      while (isParticle(words[lastStart - 1])) {
        lastStart--;
      }
      first = lastStart - 1;
    }
    if (isFirstName || first < 0 || !isNameWord(words[first])) {
      // The match is the first name: the last name follows it.
      first = index;
      lastStart = index + 1;
      lastEnd = lastStart;
      while (isParticle(words[lastEnd])) {
        lastEnd++;
      }
      if (lastEnd >= words.length || !isNameWord(words[lastEnd])) {
        continue;
      }
    }

    const before = splitPrefixes(words.slice(0, first).join(" "));
    return {
      // Text before the name only counts if it is nothing but salutation and titles.
      salutation: before.rest ? "" : before.prefixes,
      firstName: words[first],
      lastName: words.slice(lastStart, lastEnd + 1).join(" "),
    };
  }
  return null;
}

// Without a hint from the email: a line that consists of two to four capitalised words.
// Short or lower-case fragments at the edges are OCR noise and are ignored.
function nameFromShape(segment: string): Name | null {
  const { prefixes, rest } = splitPrefixes(segment);
  const words = rest.split(" ");
  const isNoise = (word: string) => !NAME_PARTICLES.has(word) && (word.length <= 2 || !isNameWord(word));
  while (words.length > 0 && isNoise(words[0])) {
    words.shift();
  }
  while (words.length > 0 && isNoise(words[words.length - 1])) {
    words.pop();
  }

  const core = words.join(" ");
  if (words.length < 2 || words.length > 4 || FUNCTION.test(core)) {
    return null;
  }
  if (!words.every((word) => NAME_PARTICLES.has(word) || isNameWord(word))) {
    return null;
  }

  // Particles such as "von" belong to the last name.
  const particle = words.findIndex((word, position) => position > 0 && NAME_PARTICLES.has(word));
  const split = particle > 0 ? particle : words.length - 1;
  return {
    salutation: prefixes,
    firstName: words.slice(0, split).join(" "),
    lastName: words.slice(split).join(" "),
  };
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
    if (!postal) {
      return;
    }
    fields.postalCode = postal[1];
    // A single trailing letter after the place name is OCR noise, not part of it.
    fields.city = clean(postal[2].replace(/(\s+\S)+$/, ""));
    postalIndex = index;
    used.add(index);

    // "Thunstrasse 34 CH-3005 Bern": the street can stand before the postal code on the same line.
    const before = clean(segment.slice(0, postal.index));
    const street = before.match(STREET) ?? before.match(GENERIC_STREET);
    if (street) {
      fields.street = clean(street[1]);
      fields.houseNumber = clean(street[2]);
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

  const findName = (find: (segment: string) => Name | null) => {
    segments.forEach((segment, index) => {
      const name = used.has(index) || fields.lastName ? null : find(segment);
      if (name) {
        Object.assign(fields, name);
        used.add(index);
      }
    });
  };
  if (fields.email) {
    findName((segment) => nameFromEmail(segment, fields.email));
  }
  findName(nameFromShape);

  segments.forEach((segment, index) => {
    if (!used.has(index) && !fields.function && FUNCTION.test(segment) && !/\d{3,}/.test(segment)) {
      fields.function = segment;
      used.add(index);
    }
  });

  return fields;
}
