import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/cookie";

/**
 * UX only — this is NOT the authorisation boundary.
 *
 * It merely spares a logged-out visitor a round trip by redirecting before the
 * page renders. It checks for the mere presence of a cookie, never its validity.
 * Real enforcement happens in requireAdmin(), which every page and action calls.
 * Next.js has shipped several middleware-bypass advisories; anyone who slips
 * past this still reaches requireAdmin() and gets nothing.
 */
export function middleware(request: NextRequest) {
  const hasCookie = request.cookies.has(COOKIE);

  if (!hasCookie && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
