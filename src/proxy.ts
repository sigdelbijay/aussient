import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Optimistic first gate for /admin: bounces visitors without a staff session
 * before any admin code runs. This is NOT the real security check — every admin
 * page and action still calls requireStaff(), which re-checks the database.
 */
export default auth((req) => {
  const user = req.auth?.user;
  if (!user) {
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return NextResponse.rewrite(new URL("/404", req.nextUrl), { status: 404 });
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
