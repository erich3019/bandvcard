import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5048";

export type LoginMode = "password" | "microsoft" | "none";

// Which login the backend offers; asked by the login page, so it needs no session.
export async function getLoginMode(): Promise<LoginMode> {
  const response = await fetch(`${backendUrl}/api/auth/mode`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for /api/auth/mode`);
  }
  return (await response.json()).mode;
}

// Server-side call to the backend on behalf of the current visitor: forwards the session
// cookie and sends visitors without a valid session to the login page.
// Reads cookies, so with cacheComponents it must be called inside a <Suspense> boundary.
export async function backendFetch(path: string): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${backendUrl}${path}`, {
    headers: { cookie: cookieHeader, accept: "application/json" },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
  }
  return response;
}
