import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Clay design-system pieces for the dashboard, matching the landing page:
 * soft inflated cards, pastel status pills, rainbow primary actions and inset
 * clay fields. Server-component safe (no hooks).
 */

export const ACCENTS = {
  lilac: { base: "#9277EA", light: "#C9B8FF", soft: "#EEE8FD", ink: "#5E43C7" },
  pink: { base: "#EC6FA6", light: "#FFB3D2", soft: "#FFE6F1", ink: "#B83C76" },
  amber: { base: "#F0A23A", light: "#FFD08A", soft: "#FFF0D6", ink: "#A2620F" },
  mint: { base: "#3FBF9B", light: "#9DE6CD", soft: "#DDF5EC", ink: "#1C7F62" },
  sky: { base: "#5BA7DE", light: "#AEDBFA", soft: "#E3F1FC", ink: "#2A6FA8" },
  coral: { base: "#EE6F6A", light: "#FFB3A6", soft: "#FFE7E3", ink: "#B5403A" },
  slate: { base: "#7A8796", light: "#C7CFD8", soft: "#EDEFF2", ink: "#465465" },
} as const;
export type Accent = keyof typeof ACCENTS;

export const RAINBOW = "linear-gradient(100deg, #9277EA 0%, #EC6FA6 55%, #F0A23A 100%)";

const cardShadow =
  "0 26px 50px -34px rgba(38,52,69,0.5), inset -6px -8px 18px rgba(38,52,69,0.06), inset 6px 6px 16px rgba(255,255,255,0.92)";

export const insetField: React.CSSProperties = {
  background: "#F5EFE7",
  boxShadow: "inset 4px 4px 9px rgba(38,52,69,0.09), inset -4px -4px 9px rgba(255,255,255,0.95)",
};

export function ClayCard({
  children,
  className,
  title,
  icon,
  accent = "lilac",
  action,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: LucideIcon;
  accent?: Accent;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className={cn("rounded-[28px] p-5 sm:p-6", className)}
      style={{ background: "#FFFCF7", boxShadow: cardShadow }}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2.5 font-heading text-lg font-semibold text-[color:var(--color-slate)]">
              {icon && <IconBubble icon={icon} accent={accent} size="sm" />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function IconBubble({
  icon: Icon,
  accent = "lilac",
  size = "md",
}: {
  icon: LucideIcon;
  accent?: Accent;
  size?: "sm" | "md" | "lg";
}) {
  const a = ACCENTS[accent];
  const box = size === "sm" ? "h-8 w-8 rounded-xl" : size === "lg" ? "h-14 w-14 rounded-[20px]" : "h-11 w-11 rounded-2xl";
  const glyph = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center text-white", box)}
      style={{
        background: `linear-gradient(145deg, ${a.light} 0%, ${a.base} 70%)`,
        boxShadow: `0 8px 16px -10px ${a.base}, inset -3px -4px 7px rgba(0,0,0,0.12), inset 3px 3px 6px rgba(255,255,255,0.55)`,
      }}
    >
      <Icon className={glyph} strokeWidth={2.4} />
    </span>
  );
}

export function Pill({ tone = "slate", children, className }: { tone?: Accent; children: React.ReactNode; className?: string }) {
  const a = ACCENTS[tone];
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", className)}
      style={{ background: a.soft, color: a.ink }}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-slate)]/45">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-4xl text-[color:var(--color-slate)] sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[color:var(--color-slate)]/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

const rainbowBtnStyle: React.CSSProperties = {
  background: RAINBOW,
  boxShadow:
    "0 14px 26px -14px rgba(236,111,166,0.8), inset -4px -5px 10px rgba(0,0,0,0.14), inset 5px 5px 10px rgba(255,255,255,0.35)",
};
const softBtnStyle: React.CSSProperties = {
  background: "#FFFCF7",
  boxShadow:
    "6px 8px 18px -10px rgba(38,52,69,0.3), inset -3px -3px 8px rgba(38,52,69,0.08), inset 4px 4px 9px rgba(255,255,255,0.9)",
};

const btnBase =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-55";

export function RainbowButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(btnBase, "text-white", className)} style={rainbowBtnStyle} {...props}>
      {children}
    </button>
  );
}

export function SoftButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(btnBase, "text-[color:var(--color-slate)]", className)} style={softBtnStyle} {...props}>
      {children}
    </button>
  );
}

export function RainbowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn(btnBase, "text-white", className)} style={rainbowBtnStyle}>
      {children}
    </Link>
  );
}

export function SoftLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn(btnBase, "text-[color:var(--color-slate)]", className)} style={softBtnStyle}>
      {children}
    </Link>
  );
}

export function EmptyState({
  icon,
  accent = "lilac",
  title,
  children,
}: {
  icon: LucideIcon;
  accent?: Accent;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center" style={insetField}>
      <IconBubble icon={icon} accent={accent} size="lg" />
      <p className="font-heading text-lg font-semibold text-[color:var(--color-slate)]">{title}</p>
      {children && <div className="max-w-md text-sm text-[color:var(--color-slate)]/65">{children}</div>}
    </div>
  );
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-sm font-bold text-[color:var(--color-slate)]">{children}</span>
      {hint && <span className="ml-2 text-xs text-[color:var(--color-slate)]/50">{hint}</span>}
    </label>
  );
}

export const fieldClass =
  "focus-ring mt-2 w-full rounded-2xl border-0 px-4 py-3 text-sm text-[color:var(--color-slate)] outline-none placeholder:text-[color:var(--color-slate)]/35";
