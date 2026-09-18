import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950/90 text-slate-400 py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200 tracking-wider text-sm">BPM · BanPickMod</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              v1.0
            </span>
          </div>
          <p className="text-xs text-slate-500 text-center md:text-left">
            StarCraft II Custom Arcade Mod & Tournament Management Platform
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <Link href="/wiki" className="hover:text-sky-400 transition">
            Wiki
          </Link>
          <Link href="/patches" className="hover:text-sky-400 transition">
            Patch Notes
          </Link>
          <Link href="/tournaments" className="hover:text-sky-400 transition">
            Tournament Engine
          </Link>
          <Link href="/ai" className="hover:text-sky-400 transition">
            AI Platform
          </Link>
          <a
            href="https://github.com/BanPickMod"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-400 transition"
          >
            GitHub
          </a>
        </div>

        <div className="text-[11px] text-slate-500">
          StarCraft is a trademark of Blizzard Entertainment, Inc.
        </div>
      </div>
    </footer>
  );
}
