import { cn } from "@/lib/utils";

/** Same semantic tones as Badge — controls the card's border/glow accent. */
export type CardTone = "neutral" | "selected" | "danger" | "success" | "warning" | "info";

const TONE_BORDER: Record<CardTone, string> = {
  neutral: "border-slate-800",
  selected: "border-sky-500/60 shadow-lg shadow-sky-500/10",
  danger: "border-rose-500/40",
  success: "border-emerald-500/40",
  warning: "border-amber-500/40",
  info: "border-sky-500/20",
};

const TONE_HOVER: Record<CardTone, string> = {
  neutral: "hover:border-slate-700",
  selected: "",
  danger: "hover:border-rose-500/60",
  success: "hover:border-emerald-500/60",
  warning: "hover:border-amber-500/60",
  info: "",
};

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-6 sm:p-8",
} as const;

interface CardProps {
  tone?: CardTone;
  padding?: keyof typeof PADDING;
  hoverable?: boolean;
  glass?: boolean;
  as?: "div" | "article" | "section";
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

/**
 * Standard content card. Replaces the repeated inline
 * `bpm-glass rounded-2xl border-slate-800 p-6` pattern so tone/spacing
 * changes only need to happen here.
 */
export function Card({
  tone = "neutral",
  padding = "md",
  hoverable = false,
  glass = true,
  as: Tag = "div",
  className,
  children,
  onClick,
}: CardProps) {
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "rounded-2xl border transition flex flex-col",
        glass ? "bpm-glass" : "bg-slate-900/80",
        TONE_BORDER[tone],
        hoverable && TONE_HOVER[tone],
        PADDING[padding],
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </Tag>
  );
}
