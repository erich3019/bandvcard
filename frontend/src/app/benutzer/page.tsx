import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";
import { type ManagedUser, UserTable } from "./user-table";

export const metadata: Metadata = { title: "Benutzer – bandvcard" };

async function Users() {
  const response = await backendFetch("/api/Users?$orderby=lastName,firstName,email&$top=100&$count=true");
  // The backend enforces the role; this page only reports its answer.
  if (response.status === 403) {
    return <p role="alert">Diese Seite ist Administratoren vorbehalten.</p>;
  }
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for the user list`);
  }
  const data: { "@odata.count": number; value: ManagedUser[] } = await response.json();
  const me = await getCurrentUser();

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Benutzer werden bei ihrer ersten Anmeldung angelegt. Normale Benutzer sehen nur ihre eigenen Kontakte,
        Administratoren alle.
        {data["@odata.count"] > data.value.length &&
          ` Angezeigt werden die ersten ${data.value.length} von ${data["@odata.count"]} Benutzern.`}
      </p>
      <UserTable users={data.value} currentEmail={me.email} />
    </>
  );
}

export default function UsersPage() {
  return (
    <PageShell title="Benutzer">
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Lädt …</p>}>
        <Users />
      </Suspense>
    </PageShell>
  );
}
