import { NextResponse, type NextRequest } from "next/server";
import { defaultLang, isLang, locales, type Lang } from "@/lib/i18n/config";

/** Pick the best supported locale from an Accept-Language header. */
function preferredLang(header: string | null): Lang {
  if (!header) return defaultLang;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const hit = ranked.find((r) => isLang(r.base));
  return hit && isLang(hit.base) ? hit.base : defaultLang;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return;

  const saved = request.cookies.get("bpm-lang")?.value;
  const lang = saved && isLang(saved) ? saved : preferredLang(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and any path with a file extension (images, favicon, data).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
