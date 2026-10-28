"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Lang } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { primaryNav, secondaryNav, type NavItem } from "./nav";
import { ProfileMenu } from "./ProfileMenu";
import { LangToggle, ThemeToggle } from "./Toggles";

export function Header({ lang, dict }: { lang: Lang; dict: Dictionary }) {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.path === "" || item.path.startsWith("#")) return item.path === "" && pathname === `/${lang}`;
    return pathname.startsWith(`/${lang}${item.path}`);
  };

  const render = (item: NavItem) => {
    const label = dict.nav[item.key];
    if (!item.live) {
      return (
        <span key={item.key} className="nav-a is-soon" title={dict.soon}>
          <span>{label}</span>
        </span>
      );
    }
    const on = isActive(item);
    return (
      <Link
        key={item.key}
        className={`nav-a${on ? " is-on" : ""}`}
        href={`/${lang}${item.path}`}
        aria-current={on ? "page" : undefined}
      >
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <header className="top">
      <Link className="brand" href={`/${lang}`} aria-label={dict.brandLabel}>
        <span className="brand-mark">
          BAN<i>/</i>PICK
        </span>
      </Link>
      <nav className="nav" aria-label={dict.primaryNav}>
        {primaryNav.map(render)}
        <span className="nav-sep" />
        {secondaryNav.map(render)}
      </nav>
      <div className="ctl">
        <ProfileMenu lang={lang} />
        <LangToggle lang={lang} label={dict.switchLang} />
        <ThemeToggle labels={{ switch: dict.switchTheme, light: dict.themeLight, dark: dict.themeDark }} />
      </div>
    </header>
  );
}
