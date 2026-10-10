import type { CardFields } from "./parse-card";

// The session can end while the page is open; callers send the user to the login page.
export class SessionExpiredError extends Error {
  constructor() {
    super("Die Anmeldung ist abgelaufen.");
  }
}

async function send(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status === 401) {
    throw new SessionExpiredError();
  }
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const json = JSON.parse(body);
      message = json.error?.message ?? json.detail ?? json.title ?? body;
    } catch {
      // Not JSON: use the text as it is.
    }
    throw new Error(message || `Fehler ${response.status}`);
  }
  return response;
}

export async function uploadPhoto(photo: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", photo, "card.jpg");
  const response = await send("/api/photos", { method: "POST", body: form });
  return (await response.json()).photoLink;
}

export async function createContact(fields: CardFields, photoLink: string): Promise<void> {
  // Empty inputs are sent as null, so "not on the card" stays distinguishable from text.
  const contact = Object.fromEntries(
    Object.entries({ ...fields, photoLink }).map(([key, value]) => [key, value.trim() || null]),
  );
  await send("/api/Contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contact),
  });
}
