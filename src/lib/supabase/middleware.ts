import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/env";

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );
}

function shouldRefreshSupabaseSession(pathname: string) {
  if (pathname === "/login") {
    return true;
  }

  if (
    pathname === "/my" ||
    pathname.startsWith("/my/") ||
    pathname === "/practice" ||
    pathname.startsWith("/practice/") ||
    pathname === "/reviews" ||
    pathname.startsWith("/reviews/")
  ) {
    return true;
  }

  if (
    pathname.startsWith("/concerts/") &&
    (pathname.includes("/seat-map") ||
      pathname.includes("/practice") ||
      pathname.includes("/reviews/new"))
  ) {
    return true;
  }

  if (
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/seat-") ||
    pathname.startsWith("/api/practice-") ||
    pathname.startsWith("/api/reviews")
  ) {
    return true;
  }

  if (pathname.startsWith("/api/concerts/") && pathname.includes("/reviews")) {
    return true;
  }

  return false;
}

export async function updateSupabaseSession(request: NextRequest) {
  const config = getSupabasePublicConfig();
  let response = NextResponse.next({
    request,
  });

  if (
    !config ||
    !hasSupabaseAuthCookie(request) ||
    !shouldRefreshSupabaseSession(request.nextUrl.pathname)
  ) {
    return response;
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
