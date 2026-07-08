import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Allow embedding the designer inside bik-ag.ch product pages. */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  // Public designer + assets may be framed on BIK
  if (path === "/" || path.startsWith("/_next") || path.startsWith("/api") || path.startsWith("/keytag")) {
    res.headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'self' https://bik-ag.ch https://www.bik-ag.ch"
    );
    res.headers.delete("X-Frame-Options");
  }

  return res;
}

export const config = {
  matcher: ["/((?!admin).*)"],
};
