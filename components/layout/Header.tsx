"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Shield, Swords, Sparkles, BookOpen, FileText, Play } from "lucide-react";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: Shield },
  { name: "Patch Notes", href: "/patches", icon: FileText },
  { name: "Wiki", href: "/wiki", icon: BookOpen },
  { name: "AI", href: "/ai", icon: Sparkles },
  { name: "Replays/Tournament", href: "/tournaments", icon: Swords },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-sky-500/15 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-600 p-[1px] shadow-lg shadow-sky-500/20 group-hover:shadow-sky-400/40 transition">
              <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                <span className="text-xs font-black tracking-widest text-sky-400">BPM</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wider text-slate-100 group-hover:text-sky-400 transition">
                BanPickMod
              </span>
              <span className="text-[10px] text-slate-400 tracking-tight">StarCraft II Platform</span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  isActive
                    ? "text-sky-400 bg-sky-500/10 border border-sky-500/20 shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5 opacity-70" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* CTA Button */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/#how-to-play"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-950 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 shadow-md shadow-sky-500/20 hover:shadow-sky-400/40 transition transform active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Play BPM
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-sky-500/15 bg-slate-950/95 px-4 pt-2 pb-4 space-y-1 backdrop-blur-2xl">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? "text-sky-400 bg-sky-500/10 border border-sky-500/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          <div className="pt-2">
            <Link
              href="/#how-to-play"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md text-sm font-semibold text-slate-950 bg-gradient-to-r from-sky-400 to-cyan-400 shadow-md"
            >
              <Play className="w-4 h-4 fill-current" />
              Play BPM
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
