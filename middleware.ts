import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/assets");
}

function isAuthApi(pathname: string) {
  return pathname.startsWith("/api/auth/");
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname) || isAuthApi(pathname)) {
    if (pathname === "/login") {
      const authenticated = await isAuthenticated(request.cookies.get(AUTH_COOKIE_NAME)?.value);

      if (authenticated) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    return NextResponse.next();
  }

  const authenticated = await isAuthenticated(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (authenticated) {
    return NextResponse.next();
  }

  if (isApiPath(pathname)) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"]
};
