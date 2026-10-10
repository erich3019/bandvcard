import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Must match AuthSetup.CookieName in the backend.
const SESSION_COOKIE = "bandvcard.auth";

// Optimistic check only: it sends visitors without a session cookie to the login page.
// Whether the cookie is valid is decided by the backend (see lib/auth.ts).
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|tesseract|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
