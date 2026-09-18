import { cn } from "@/lib/utils";

/**
 * Semantic tone — NOT a raw color choice. Pick the tone that matches the
 * badge's meaning, not the hue you want. This is what keeps "sky" from
 * meaning "Terran" on one page and "selected tab" on another.
 *
 * - race-*   : identifies a StarCraft race. Never reuse these hues for
 *              status/selection meaning on a page that also shows race data.
 * - selected : this option/tab/step is currently active or chosen.
 * - danger   : ban, destructive, or "will be removed" state.
 * - success  : complete, live-active, verified.
 * - warning  : time-sensitive, PTR/experimental, needs attention.
 * - info     : neutral informative label (counts, categories).
 * - demo     : marks mocked/sample data that is not live/real.
 * - neutral  : default, low-emphasis label.
 */
export type BadgeTone =
  | "race-terran"
  | "race-protoss"
  | "race-zerg"
  | "selected"
  | "danger"
  | "success"
  | "warning"
  | "info"
  | "demo"
  | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  "race-terran": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "race-protoss": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "race-zerg": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  selected: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-slate-800 text-slate-300 border-slate-700",
  demo: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30",
  neutral: "bg-slate-900 text-slate-400 border-slate-800",
};

const SIZE_CLASSES = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2.5 py-0.5 gap-1.5",
} as const;

interface BadgeProps {
  tone?: BadgeTone;
  size?: keyof typeof SIZE_CLASSES;
  uppercase?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Badge({
  tone = "neutral",
  size = "md",
  uppercase = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-bold font-mono whitespace-nowrap",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        uppercase && "uppercase tracking-wider",
        className
      )}
    >
      {children}
    </span>
  );
}
