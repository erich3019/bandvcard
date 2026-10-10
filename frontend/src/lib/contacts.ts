import { type CardFields, emptyCardFields } from "./parse-card";

export type Opportunity = {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
};

export const OPPORTUNITY_MAX_LENGTH = 200;

// The release for the import into the ERP system Abacus. People set "ToImport" ("übernehmen")
// and take it back; the import sets "Imported" ("übernommen") together with the date.
export type AbacusStatus = "None" | "ToImport" | "Imported";

export const abacusStatusLabels: Record<AbacusStatus, string> = {
  None: "nicht freigegeben",
  ToImport: "übernehmen",
  Imported: "übernommen",
};

// A contact as the OData API returns it: fields that are not set are null.
export type Contact = { [Field in keyof CardFields]: string | null } & {
  id: string;
  photoLink: string | null;
  abacusStatus: AbacusStatus;
  abacusImportedAt: string | null;
  // Only present when requested with $expand.
  opportunities?: Opportunity[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type ContactSummary = Pick<
  Contact,
  "id" | "firstName" | "lastName" | "companyName" | "function" | "city" | "email" | "phone" | "mobile" | "abacusStatus"
>;

export function toCardFields(contact: Contact): CardFields {
  const fields = { ...emptyCardFields };
  for (const key of Object.keys(fields) as (keyof CardFields)[]) {
    fields[key] = contact[key] ?? "";
  }
  return fields;
}

export function displayName(contact: Pick<Contact, "firstName" | "lastName" | "companyName">): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.companyName || "(ohne Namen)";
}

export function isContactId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export const CONTACTS_PAGE_SIZE = 25;

const SEARCH_FIELDS = ["lastName", "firstName", "companyName", "city", "email"];

// OData query for one page of the contact list, optionally filtered by a search text
// that may appear in any of the search fields.
export function contactListQuery(search: string, page: number): string {
  const params = [
    "$select=id,firstName,lastName,companyName,function,city,email,phone,mobile,abacusStatus",
    "$orderby=lastName,firstName,companyName",
    `$top=${CONTACTS_PAGE_SIZE}`,
    `$skip=${(page - 1) * CONTACTS_PAGE_SIZE}`,
    "$count=true",
  ];
  const term = search.trim().toLowerCase();
  if (term) {
    // A single quote inside an OData string literal is escaped by doubling it.
    const literal = `'${term.replaceAll("'", "''")}'`;
    const filter = SEARCH_FIELDS.map((field) => `contains(tolower(${field}),${literal})`).join(" or ");
    params.push(`$filter=${encodeURIComponent(filter)}`);
  }
  return params.join("&");
}
