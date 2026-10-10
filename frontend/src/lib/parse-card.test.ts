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
      mobile: "+49 171 2345678",
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

  it("puts a mobile number into the mobile field and never uses the fax", () => {
    const fields = parseCard("Frau Petra Beispiel\nFax 030 1111111\nMobil 0171 2222222");

    expect(fields.salutation).toBe("Frau");
    expect(fields.lastName).toBe("Beispiel");
    expect(fields.phone).toBe("");
    expect(fields.mobile).toBe("0171 2222222");
  });

  it("recognises mobile numbers without a label by their network prefix", () => {
    expect(parseCard("+41 31 333 80 22\n+41 79 321 69 27")).toMatchObject({
      phone: "+41 31 333 80 22",
      mobile: "+41 79 321 69 27",
    });
    expect(parseCard("0049 171 2345678")).toMatchObject({ phone: "", mobile: "0049 171 2345678" });
    // Without a country code "07…" can be a German landline, so it stays a phone number.
    expect(parseCard("0711 1234567")).toMatchObject({ phone: "0711 1234567", mobile: "" });
  });

  it("prefers the labelled landline over an unlabelled number", () => {
    expect(parseCard("030 9999999\nTel. 030 1234567\nM 0160 7654321")).toMatchObject({
      phone: "030 1234567",
      mobile: "0160 7654321",
    });
  });

  it("accepts a street without a typical suffix directly before the postal code", () => {
    const fields = parseCard("Jan Test\nAm Hang 7\n12345 Berlin");

    expect(fields).toMatchObject({ street: "Am Hang", houseNumber: "7", postalCode: "12345", city: "Berlin" });
  });

  it("does not mistake a job title for the name", () => {
    const fields = parseCard("Senior Account Manager\nMax Muster");

    expect(fields).toMatchObject({ firstName: "Max", lastName: "Muster", function: "Senior Account Manager" });
  });

  // The next cases are real OCR results of photographed cards, noise included.
  const gasser = {
    salutation: "",
    firstName: "Andreas",
    lastName: "Gasser",
    companyName: "Aberegg Consulting AG",
    function: "",
    street: "Thunstrasse",
    houseNumber: "34",
    postalCode: "3005",
    city: "Bern",
    email: "gasser@aberegg-consulting.ch",
  };

  it("finds the name behind OCR noise and street and place on one line", () => {
    const fields = parseCard(`AbereggConsultin
0 A Andreas Gasser
Aberegg Consulting AG
Thunstrasse 34 CH-3005 Bern
gasser@aberegg-consulting.ch
www.aberegg-consulting.ch
T +41 31 33380 22
M +41 79 321 69 27`);

    expect(fields).toEqual({ ...gasser, phone: "+41 31 33380 22", mobile: "+41 79 321 69 27" });
  });

  it("copes with heavy noise around every line", () => {
    const fields = parseCard(`tl ee ii tcl cn het Si cs So Bl = - -
AbereggConsultin
i gh eel Andreas Gasser |
EE OTE ed A Be Bh as sp em oA EB SL DIeLS 5 0nd ALG Pe Co bie hh 3
Aberegg Consulting AG |
Thunstrasse 34 CH-3005 Bern i
gasser@aberegg-consulting.ch

www.aberegg-consulting.ch 1

T+41313338022 §

M+41793216927 B`);

    expect(fields).toEqual({ ...gasser, phone: "+41313338022", mobile: "+41793216927" });
  });

  it("finds the name when OCR merges it with the logo text, and ignores the slogan", () => {
    const fields = parseCard(`AbereggConsulting Andreas Gasser
Mehr Mensch, Mehr Qualität,
nm oe REECE i Se LL LS TE ne
Aberegg Consulting AG
Thunstrasse 34 CH-3005 Bern
gasser@aberegg-consulting.ch
T +41 31 33380 22`);

    expect(fields).toMatchObject({ firstName: "Andreas", lastName: "Gasser", companyName: "Aberegg Consulting AG" });
  });

  it("uses an initial-style email address as hint for the last name", () => {
    const fields = parseCard(`Bernhard Beispiel C
Einkaufsleiter
SAMPLE International GmbH
Musterplatz 1, 1234 Irgendwo
Tel: +99 12 345 67 89-012
Fax: +99 12 345 67 89-001
E-Mail: b.beispiel@sample-corporation.com
www.sample-corporation.com
i
PETE
J`);

    expect(fields).toEqual({
      salutation: "",
      firstName: "Bernhard",
      lastName: "Beispiel",
      companyName: "SAMPLE International GmbH",
      function: "Einkaufsleiter",
      street: "Musterplatz",
      houseNumber: "1",
      postalCode: "1234",
      city: "Irgendwo",
      phone: "+99 12 345 67 89-012",
      mobile: "",
      email: "b.beispiel@sample-corporation.com",
    });
  });

  it("matches umlauts in the name with their spelling in the email address", () => {
    const fields = parseCard("Lärm Schutz GmbH\nxx Jörg Müller\njoerg.mueller@example.com");

    expect(fields).toMatchObject({ firstName: "Jörg", lastName: "Müller", companyName: "Lärm Schutz GmbH" });
  });

  it("keeps salutation and title before a name found through the email address", () => {
    const fields = parseCard("Herr Dr. Hans von Allmen\nallmen@example.ch");

    expect(fields).toMatchObject({ salutation: "Herr Dr.", firstName: "Hans", lastName: "von Allmen" });
  });

  it("returns empty fields for unusable text", () => {
    expect(parseCard("~~ \n ..")).toEqual(emptyCardFields);
  });
});
