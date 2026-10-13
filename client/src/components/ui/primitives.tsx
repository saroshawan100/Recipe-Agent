import type { HTMLAttributes, ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Popover as P, Slider as S, Switch as Sw, Tabs as T } from "radix-ui";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-3xl shadow-xl shadow-black/5", className)} {...props} />;
}

type BadgeTone = "neutral" | "saffron" | "herb" | "tomato";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted",
  saffron: "bg-saffron-500/15 text-saffron-700 dark:text-saffron-300",
  herb: "bg-herb-500/15 text-herb-700 dark:text-herb-300",
  tomato: "bg-tomato-500/15 text-tomato-600 dark:text-tomato-300",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer-bg animate-shimmer rounded-xl", className)} />;
}

export function Chip({
  active,
  onClick,
  children,
  className,
  tone = "saffron",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  tone?: "saffron" | "herb" | "tomato";
}) {
  const activeTone = {
    saffron: "border-saffron-500 bg-saffron-500/15 text-saffron-700 dark:text-saffron-200",
    herb: "border-herb-500 bg-herb-500/15 text-herb-700 dark:text-herb-200",
    tomato: "border-tomato-500 bg-tomato-500/15 text-tomato-600 dark:text-tomato-200",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95",
        active ? activeTone : "border-line text-muted hover:border-muted/60 hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-xl bg-surface-2 p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 12,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
      <button
        type="button"
        aria-label={`Decrease ${label ?? "value"}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg hover:bg-surface disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`Increase ${label ?? "value"}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg hover:bg-surface disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
}) {
  return (
    <S.Root
      className="relative flex h-5 w-full touch-none items-center select-none"
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
      aria-label={label}
    >
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-2">
        <S.Range className="absolute h-full rounded-full bg-gradient-to-r from-saffron-400 to-saffron-600" />
      </S.Track>
      <S.Thumb className="block h-5 w-5 cursor-grab rounded-full border-2 border-saffron-500 bg-surface shadow-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron-500/30" />
    </S.Root>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Sw.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-surface-2 ring-1 ring-line transition-colors data-[state=checked]:bg-saffron-500"
    >
      <Sw.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </Sw.Root>
  );
}

export const Tabs = T.Root;

export function TabsList({ className, ...props }: T.TabsListProps) {
  return <T.List className={cn("flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1 scrollbar-none", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: T.TabsTriggerProps) {
  return (
    <T.Trigger
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap text-muted transition-all hover:text-fg data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = T.Content;

export function Popover({
  trigger,
  children,
  className,
  side = "bottom",
}: {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <P.Root>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50 max-w-xs rounded-2xl border border-line bg-surface p-4 text-sm shadow-2xl shadow-black/20 outline-none",
            className,
          )}
        >
          {children}
          <P.Arrow className="fill-surface" />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-2 text-xs font-semibold tracking-wider text-muted uppercase", className)}>{children}</div>;
}
