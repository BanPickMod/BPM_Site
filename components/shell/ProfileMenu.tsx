"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n/config";

interface ProfileUser {
  id: number;
  displayName: string;
}

export function ProfileMenu({ lang }: { lang: Lang }) {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/me", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ProfileUser;
      })
      .then((profile) => {
        setUser(profile);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  if (!loaded) return <span className="profile-load" aria-hidden />;
  if (!user) return null;

  const initial = Array.from(user.displayName.trim())[0]?.toUpperCase() ?? "B";
  const label = lang === "ko" ? "계정·내 리플레이" : "Account & replays";

  return (
    <Link className="profile" href={`/${lang}/account`} aria-label={`${user.displayName}, ${label}`}>
      <span className="profile-avatar" aria-hidden>
        {initial}
      </span>
      <span className="profile-meta">
        <strong>{user.displayName}</strong>
        <small>{label}</small>
      </span>
    </Link>
  );
}
