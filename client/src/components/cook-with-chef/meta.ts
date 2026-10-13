import { AlertTriangle, CheckCircle2, Hand, Lightbulb, Timer, type LucideIcon } from "lucide-react";
import type { CueType, HeatLevel } from "@/api/types";

export const CUE_META: Record<CueType, { label: string; icon: LucideIcon; tone: string; ring: string }> = {
  action: { label: "Do this", icon: Hand, tone: "text-saffron-600 dark:text-saffron-300", ring: "bg-saffron-500/15" },
  check: { label: "Check", icon: CheckCircle2, tone: "text-herb-600 dark:text-herb-300", ring: "bg-herb-500/15" },
  warning: { label: "Careful", icon: AlertTriangle, tone: "text-tomato-600 dark:text-tomato-300", ring: "bg-tomato-500/15" },
  meanwhile: { label: "Meanwhile", icon: Timer, tone: "text-sky-600 dark:text-sky-300", ring: "bg-sky-500/15" },
  tip: { label: "Chef's tip", icon: Lightbulb, tone: "text-amber-600 dark:text-amber-300", ring: "bg-amber-500/15" },
};

export const HEAT_META: Record<HeatLevel, { label: string; flames: number }> = {
  none: { label: "No heat", flames: 0 },
  low: { label: "Low heat", flames: 1 },
  "medium-low": { label: "Medium-low", flames: 2 },
  medium: { label: "Medium heat", flames: 3 },
  "medium-high": { label: "Medium-high", flames: 4 },
  high: { label: "High heat", flames: 5 },
};

const HEAT_ORDER: HeatLevel[] = ["low", "medium-low", "medium", "medium-high", "high"];

export function adjustHeat(level: HeatLevel, change: "none" | "lower" | "raise" | "off"): HeatLevel {
  if (change === "off") return "none";
  if (change === "none" || level === "none") return level;
  const i = HEAT_ORDER.indexOf(level);
  return HEAT_ORDER[Math.min(HEAT_ORDER.length - 1, Math.max(0, i + (change === "raise" ? 1 : -1)))];
}

export const PROBLEM_OPTIONS = [
  { id: "sticking", label: "It's sticking to the pan", emoji: "🍳" },
  { id: "burning", label: "It's burning or too dark", emoji: "🔥" },
  { id: "smoking", label: "Pan is smoking a lot", emoji: "💨" },
  { id: "not-browning", label: "It's not browning", emoji: "🤔" },
  { id: "watery", label: "Too watery / not thickening", emoji: "💧" },
  { id: "splatter", label: "Oil is splattering", emoji: "💥" },
  { id: "undercooked", label: "Looks undercooked inside", emoji: "🥩" },
  { id: "too-thick", label: "Too thick or dry", emoji: "🧱" },
];
