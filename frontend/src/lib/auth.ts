import "server-only";
import { backendFetch } from "./backend";

export type CurrentUser = {
  email: string;
  firstName: string | null;
  lastName: string | null;
};

// The backend owns the session; this asks it who the cookie belongs to.
export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await backendFetch("/api/auth/me");
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for /api/auth/me`);
  }

  return response.json();
}
