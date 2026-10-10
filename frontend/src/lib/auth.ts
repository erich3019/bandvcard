import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type CurrentUser = {
  email: string;
  firstName: string | null;
  lastName: string | null;
};

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5048";

// The backend owns the session; this asks it who the cookie belongs to.
export async function getCurrentUser(): Promise<CurrentUser> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${backendUrl}/api/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
  }
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for /api/auth/me`);
  }

  return response.json();
}
