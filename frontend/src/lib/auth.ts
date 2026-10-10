import "server-only";
import { cache } from "react";
import { backendFetch } from "./backend";

export type CurrentUser = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "Admin" | "User";
};

// The backend owns the session; this asks it who the cookie belongs to.
// Cached per request, so several components can ask without several backend calls.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const response = await backendFetch("/api/auth/me");
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for /api/auth/me`);
  }

  return response.json();
});
