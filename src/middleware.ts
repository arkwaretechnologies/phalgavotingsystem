import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;

  // Admin uses `phalga_admin_session` (see `lib/admin/session.ts`), not Supabase Auth.
  // Running `createServerClient` + `getUser()` here still mutates auth cookies and can
  // cause unnecessary Set-Cookie churn; @supabase/ssr notes that can surface as random
  // logouts behind reverse proxies. Skip Supabase entirely for `/admin`.
  if (pathname.startsWith("/admin")) {
    // Rebuild headers with append so multi-value / proxy headers behave like the raw request.
    // Some stacks have been sensitive to `new Headers(request.headers)` + `set` for custom keys.
    const forwarded = new Headers();
    request.headers.forEach((value, key) => {
      forwarded.append(key, value);
    });
    forwarded.set("x-phalga-path", pathname);
    return NextResponse.next({
      request: { headers: forwarded },
    });
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session if expired. (Keeps auth cookies in sync.)
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
      Exclude:
      - next internals
      - static assets
      - public files
    */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

