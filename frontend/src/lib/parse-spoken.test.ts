import { describe, expect, it } from "vitest";
import { emptyCardFields } from "./parse-card";
import { normalizeSpokenValue, parseSpokenContact } from "./parse-spoken";

describe("parseSpokenContact", () => {
  it("assigns values by the spoken field names", () => {
    const fields = parseSpokenContact(
      "Anrede Herr, Vorname Andreas, Nachname Gasser, Firma Aberegg Consulting AG, Funktion Consultant, " +
        "Straße Thunstrasse 34, Postleitzahl 3005, Ort Bern, Telefon 031 333 80 22, Mobil 079 321 69 27, " +
        "E-Mail gasser at aberegg minus consulting punkt ch",
    );

    expect(fields).toEqual({
      salutation: "Herr",
      firstName: "Andreas",
      lastName: "Gasser",
      companyName: "Aberegg Consulting AG",
      function: "Consultant",
      street: "Thunstrasse",
      houseNumber: "34",
      postalCode: "3005",
      city: "Bern",
      phone: "031 333 80 22",
      mobile: "079 321 69 27",
      email: "gasser@aberegg-consulting.ch",
    });
  });

  it("accepts any order, lower case and no punctuation", () => {
    const fields = parseSpokenContact("ort zürich firma muster gmbh nachname müller vorname jörg");

    expect(fields).toMatchObject({ city: "Zürich", companyName: "muster gmbh", lastName: "Müller", firstName: "Jörg" });
  });

  it("takes text before the first field name as the name", () => {
    const fields = parseSpokenContact("Hans von Allmen, Firma Alpen Treuhand AG");

    expect(fields).toMatchObject({ firstName: "Hans", lastName: "von Allmen", companyName: "Alpen Treuhand AG" });
  });

  it("splits a full name given as 'Name'", () => {
    expect(parseSpokenContact("Name Erika Mustermann Ort Bern")).toMatchObject({
      firstName: "Erika",
      lastName: "Mustermann",
      city: "Bern",
    });
    expect(parseSpokenContact("Name Mustermann")).toMatchObject({ firstName: "", lastName: "Mustermann" });
  });

  it("understands field names written as one or several words", () => {
    const fields = parseSpokenContact(
      "Vor Name Petra Nach Name Beispiel Handy Nummer plus 41 79 111 22 33 Telefonnummer 044 123 45 67 " +
        "E Mail Adresse petra punkt beispiel at example punkt com Post Leitzahl 80 331",
    );

    expect(fields).toMatchObject({
      firstName: "Petra",
      lastName: "Beispiel",
      mobile: "+41 79 111 22 33",
      phone: "044 123 45 67",
      email: "petra.beispiel@example.com",
      postalCode: "80331",
    });
  });

  it("keeps a street name apart from a house number spoken on its own", () => {
    expect(parseSpokenContact("Adresse Am Hang Nummer 7a")).toMatchObject({ street: "Am Hang", houseNumber: "7a" });
  });

  it("uses the later value when a field is named twice", () => {
    expect(parseSpokenContact("Ort Bern Firma Test AG Ort Zürich")).toMatchObject({ city: "Zürich" });
  });

  it("keeps an email address the recogniser already wrote out", () => {
    expect(parseSpokenContact("E-Mail: Erika.Muster@Example.com.")).toMatchObject({ email: "erika.muster@example.com" });
  });

  it("returns empty fields for silence", () => {
    expect(parseSpokenContact("   ")).toEqual(emptyCardFields);
  });
});

describe("normalizeSpokenValue", () => {
  it("cleans a single dictated field", () => {
    expect(normalizeSpokenValue("email", "info at muster minus gmbh punkt de")).toBe("info@muster-gmbh.de");
    expect(normalizeSpokenValue("mobile", "plus 49 171 2345678.")).toBe("+49 171 2345678");
    expect(normalizeSpokenValue("lastName", "von allmen,")).toBe("von Allmen");
    expect(normalizeSpokenValue("companyName", "Muster GmbH.")).toBe("Muster GmbH");
    expect(normalizeSpokenValue("salutation", "herr dr.")).toBe("Herr Dr.");
  });
});
