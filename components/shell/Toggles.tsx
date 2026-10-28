"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import type { Lang } from "@/lib/i18n/config";

export function LangToggle({ lang, label }: { lang: Lang; label: string }) {
  const pathname = usePathname();
  const next: Lang = lang === "ko" ? "en" : "ko";

  const onClick = () => {
    document.cookie = `bpm-lang=${next}; path=/; max-age=31536000; samesite=lax`;
    const rest = pathname.replace(/^\/(ko|en)/, "");
    // The root layout (<html lang>) depends on the locale, so switch with a full page load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${next}${rest}${window.location.hash}`);
  };

  return (
    <button className="ctl-btn" type="button" onClick={onClick} aria-label={label}>
      {next.toUpperCase()}
    </button>
  );
}

type Theme = "dark" | "light";

const subscribeTheme = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
};
const readTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function ThemeToggle({ labels }: { labels: { switch: string; light: string; dark: string } }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);

  const onClick = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("bpm.theme", next);
    } catch {}
  };

  return (
    <button className="ctl-btn" type="button" onClick={onClick} aria-label={labels.switch} aria-pressed={theme === "light"}>
      {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
      <span className="ctl-lbl">{theme === "dark" ? labels.light : labels.dark}</span>
    </button>
  );
}
