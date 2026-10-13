import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

/** 1.5 -> "1½", 0.333 -> "⅓", 2.37 -> "2.4" */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.06) return String(whole || n.toFixed(2));
  if (frac > 0.94) return String(whole + 1);
  const match = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.05);
  if (match) return `${whole || ""}${match[1]}`;
  return (Math.round(n * 10) / 10).toString();
}

const COUNT_UNITS = new Set(["clove", "can", "cup", "slice", "piece", "stalk", "sprig", "pinch", "dash", "bunch", "head", "fillet", "breast", "thigh", "egg", "jar", "package", "leaf", "strip"]);

function pluralizeUnit(unit: string, value: number): string {
  if (value <= 1 || !COUNT_UNITS.has(unit.toLowerCase())) return unit;
  if (/(ch|sh)$/i.test(unit)) return `${unit}es`;
  if (/leaf$/i.test(unit)) return unit.replace(/f$/i, "ves");
  return `${unit}s`;
}

export function formatQuantity(amount: number | null, unit: string | null, scale = 1): string {
  const value = amount !== null ? amount * scale : null;
  const a = value !== null ? formatAmount(value) : "";
  const u = unit ? (value !== null ? pluralizeUnit(unit, value) : unit) : "";
  return [a, u].filter(Boolean).join(" ");
}

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** 95 -> "1 hr 35 min", 20 -> "20 min" */
export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

const GRADIENTS = [
  "from-saffron-400/80 to-tomato-500/80",
  "from-herb-400/80 to-herb-700/80",
  "from-tomato-400/80 to-saffron-600/80",
  "from-saffron-300/80 to-herb-500/80",
  "from-amber-500/80 to-rose-600/80",
  "from-emerald-400/80 to-teal-700/80",
  "from-orange-400/80 to-red-600/80",
  "from-lime-400/80 to-emerald-600/80",
];

export function gradientFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^\s*[-+]\s+/gm, "")
    .trim();
}
