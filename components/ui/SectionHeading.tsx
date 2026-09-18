import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Text color for the eyebrow label only — kept separate from Badge tones
 *  since an eyebrow has no border/background, just a tinted label. */
export type HeadingAccent =
  | "sky"
  | "amber"
  | "purple"
  | "emerald"
  | "rose"
  | "cyan"
  | "slate";

const ACCENT_TEXT: Record<HeadingAccent, string> = {
  sky: "text-sky-400",
  amber: "text-amber-400",
  purple: "text-purple-400",
  emerald: "text-emerald-400",
  rose: "text-rose-400",
  cyan: "text-cyan-400",
  slate: "text-slate-400",
};

interface SectionHeadingProps {
  eyebrow?: string;
  icon?: LucideIcon;
  accent?: HeadingAccent;
  title: string;
  description?: string;
  /** "page" = h1 / text-3xl, "section" = h2 / text-2xl-3xl */
  level?: "page" | "section";
  align?: "left" | "center";
  className?: string;
  children?: React.ReactNode;
}

/**
 * Standard eyebrow + title + description block used at the top of every
 * page and most major sections. Consolidates the previously hand-rolled
 * markup so title/description font sizes stay consistent across pages.
 */
export function SectionHeading({
  eyebrow,
  icon: Icon,
  accent = "sky",
  title,
  description,
  level = "section",
  align = "left",
  className,
  children,
}: SectionHeadingProps) {
  const HeadingTag = level === "page" ? "h1" : "h2";

  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && (
        <div
          className={cn(
            "inline-flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider mb-2",
            ACCENT_TEXT[accent]
          )}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {eyebrow}
        </div>
      )}
      <HeadingTag
        className={cn(
          "font-black text-slate-100",
          level === "page" ? "text-3xl" : "text-2xl sm:text-3xl"
        )}
      >
        {title}
      </HeadingTag>
      {description && (
        <p
          className={cn(
            "text-sm text-slate-400 mt-2 leading-relaxed",
            align === "center" && "max-w-2xl mx-auto"
          )}
        >
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
