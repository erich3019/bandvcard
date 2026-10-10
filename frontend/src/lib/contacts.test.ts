import { describe, expect, it } from "vitest";
import { contactListQuery, displayName, isContactId } from "./contacts";

describe("contactListQuery", () => {
  it("pages without a filter when there is no search text", () => {
    const query = contactListQuery("  ", 3);

    expect(query).toContain("$top=25&$skip=50");
    expect(query).not.toContain("$filter");
  });

  it("searches case-insensitively and escapes quotes", () => {
    const query = decodeURIComponent(contactListQuery("O'Brien", 1));

    expect(query).toContain("contains(tolower(lastName),'o''brien')");
    expect(query).toContain(" or contains(tolower(companyName),'o''brien')");
  });

  it("encodes characters that would otherwise change the query", () => {
    expect(contactListQuery("a&$top=1000", 1)).not.toContain("a&$top=1000");
  });
});

describe("displayName", () => {
  it("falls back from the name to the company", () => {
    expect(displayName({ firstName: "Erika", lastName: "Muster", companyName: "Acme" })).toBe("Erika Muster");
    expect(displayName({ firstName: null, lastName: null, companyName: "Acme" })).toBe("Acme");
    expect(displayName({ firstName: null, lastName: null, companyName: null })).toBe("(ohne Namen)");
  });
});

describe("isContactId", () => {
  it("accepts only GUIDs", () => {
    expect(isContactId("01a125e2-bc0d-7abb-9a77-b67f5727613c")).toBe(true);
    expect(isContactId("1)/$count")).toBe(false);
  });
});
