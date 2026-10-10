"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteUser, SessionExpiredError, updateUser } from "@/lib/api";

export type ManagedUser = {
  email: string;
  firstName: string;
  lastName: string;
  role: "Admin" | "User";
  status: "Active" | "Inactive";
};

const selectStyle =
  "rounded-lg border border-black/15 bg-white px-2 py-1 disabled:opacity-50 dark:border-white/20 dark:bg-zinc-900";

export function UserTable({ users, currentEmail }: { users: ManagedUser[]; currentEmail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (actionError) {
      if (actionError instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setBusy(false);
      // Also after a failure, so the selects show the stored values again.
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
        {users.map((user) => {
          const self = user.email === currentEmail;
          const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
          return (
            <li key={user.email} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <span className="font-medium">{name || user.email}</span>
                {self && <span className="text-sm text-zinc-600 dark:text-zinc-400"> (Sie)</span>}
                <span className="block truncate text-sm text-zinc-600 dark:text-zinc-400">{user.email}</span>
              </div>
              {/* key: the select snaps back to the stored value when the list is reloaded. */}
              <select
                key={`role-${user.role}`}
                aria-label={`Rolle von ${user.email}`}
                defaultValue={user.role}
                disabled={busy || self}
                onChange={(event) => void run(() => updateUser(user.email, { role: event.target.value }))}
                className={selectStyle}
              >
                <option value="User">Benutzer</option>
                <option value="Admin">Admin</option>
              </select>
              <select
                key={`status-${user.status}`}
                aria-label={`Status von ${user.email}`}
                defaultValue={user.status}
                disabled={busy || self}
                onChange={(event) => void run(() => updateUser(user.email, { status: event.target.value }))}
                className={selectStyle}
              >
                <option value="Active">aktiv</option>
                <option value="Inactive">inaktiv</option>
              </select>
              <button
                type="button"
                disabled={busy || self}
                onClick={() => {
                  if (window.confirm(`Benutzer ${user.email} wirklich löschen? Seine Kontakte bleiben erhalten.`)) {
                    void run(() => deleteUser(user.email));
                  }
                }}
                className="rounded-full border border-red-700/40 px-3 py-1 text-sm text-red-800 disabled:opacity-50 dark:text-red-300"
              >
                Löschen
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
