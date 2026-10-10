import { describe, expect, it } from "vitest";
import { emptyCardFields, parseCard } from "./parse-card";

describe("parseCard", () => {
  it("reads a typical German card", () => {
    const fields = parseCard(`
      Muster Maschinenbau GmbH
      Dr. Erika Mustermann
      Leiterin Vertrieb
      Musterstraße 12a
      80331 München
      Tel.: +49 89 123456-0
      Fax: +49 89 123456-99
      Mobil: +49 171 2345678
      erika.mustermann@muster-gmbh.de
      www.muster-gmbh.de
    `);

    expect(fields).toEqual({
      salutation: "Dr.",
      firstName: "Erika",
      lastName: "Mustermann",
      companyName: "Muster Maschinenbau GmbH",
      function: "Leiterin Vertrieb",
      street: "Musterstraße",
      houseNumber: "12a",
      postalCode: "80331",
      city: "München",
      phone: "+49 89 123456-0",
      email: "erika.mustermann@muster-gmbh.de",
    });
  });

  it("reads an address on one line and a Swiss postal code", () => {
    const fields = parseCard(`
      Hans von Allmen | Geschäftsführer
      Alpen Treuhand AG
      Bahnhofplatz 3, CH-3011 Bern
      T 031 123 45 67
      Hans.vonAllmen@alpen-treuhand.ch
    `);

    expect(fields).toMatchObject({
      firstName: "Hans",
      lastName: "von Allmen",
      function: "Geschäftsführer",
      companyName: "Alpen Treuhand AG",
      street: "Bahnhofplatz",
      houseNumber: "3",
      postalCode: "3011",
      city: "Bern",
      phone: "031 123 45 67",
      email: "hans.vonallmen@alpen-treuhand.ch",
    });
  });

  it("uses the mobile number when there is no landline and never the fax", () => {
    const fields = parseCard("Frau Petra Beispiel\nFax 030 1111111\nMobil 0171 2222222");

    expect(fields.salutation).toBe("Frau");
    expect(fields.lastName).toBe("Beispiel");
    expect(fields.phone).toBe("0171 2222222");
  });

  it("accepts a street without a typical suffix directly before the postal code", () => {
    const fields = parseCard("Jan Test\nAm Hang 7\n12345 Berlin");

    expect(fields).toMatchObject({ street: "Am Hang", houseNumber: "7", postalCode: "12345", city: "Berlin" });
  });

  it("does not mistake a job title for the name", () => {
    const fields = parseCard("Senior Account Manager\nMax Muster");

    expect(fields).toMatchObject({ firstName: "Max", lastName: "Muster", function: "Senior Account Manager" });
  });

  it("returns empty fields for unusable text", () => {
    expect(parseCard("~~ \n ..")).toEqual(emptyCardFields);
  });
});
