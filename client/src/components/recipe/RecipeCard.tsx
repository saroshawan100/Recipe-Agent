import { motion } from "framer-motion";
import { Check, Clock, Flame, Gauge, Heart, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import type { RecipeSummary } from "@/api/types";
import { Badge } from "@/components/ui/primitives";
import { cn, formatMinutes, gradientFor } from "@/lib/utils";

export function MacroBars({ protein, carbs, fat, className }: { protein: number; carbs: number; fat: number; className?: string }) {
  const kcal = protein * 4 + carbs * 4 + fat * 9 || 1;
  const parts = [
    { label: "P", value: protein, pct: (protein * 4) / kcal, color: "bg-herb-500" },
    { label: "C", value: carbs, pct: (carbs * 4) / kcal, color: "bg-saffron-500" },
    { label: "F", value: fat, pct: (fat * 9) / kcal, color: "bg-tomato-400" },
  ];
  return (
    <div className={className}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-2">
        {parts.map((p) => (
          <div key={p.label} className={p.color} style={{ width: `${p.pct * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex gap-3 text-xs text-muted">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", p.color)} />
            <span className="font-semibold text-fg tabular-nums">{Math.round(p.value)}g</span>
            {p.label === "P" ? "protein" : p.label === "C" ? "carbs" : "fat"}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MatchRing({ percent, size = 44 }: { percent: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = percent >= 90 ? "stroke-herb-500" : percent >= 60 ? "stroke-saffron-500" : "stroke-tomato-400";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={4} className="fill-none stroke-black/20" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className={cn("fill-none transition-all duration-700", color)}
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-white">{percent}%</span>
    </div>
  );
}

export function RecipeCard({ recipe, index = 0 }: { recipe: RecipeSummary; index?: number }) {
  const missing = recipe.missingIngredients;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
    >
      <Link
        to={`/recipe/${recipe.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-lg shadow-black/5 transition-all duration-300 hover:-translate-y-1 hover:border-saffron-500/40 hover:shadow-2xl hover:shadow-saffron-500/10"
      >
        <div className={cn("relative h-40 overflow-hidden bg-gradient-to-br", gradientFor(recipe.title))}>
          {recipe.imageUrl ? (
            <img src={recipe.imageUrl} alt={recipe.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid h-full place-items-center">
              <span className="animate-float text-7xl drop-shadow-xl transition-transform duration-500 group-hover:scale-110">{recipe.emoji}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute top-3 right-3 rounded-full bg-black/35 p-0.5 backdrop-blur" title={`You have ${recipe.matchPercent}% of the ingredients`}>
            <MatchRing percent={recipe.matchPercent} />
          </div>
          {recipe.saved && (
            <div className="absolute top-3 left-3 grid h-8 w-8 place-items-center rounded-full bg-black/35 backdrop-blur">
              <Heart className="h-4 w-4 fill-tomato-400 text-tomato-400" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{recipe.cuisine}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div>
            <h3 className="text-lg leading-snug font-semibold transition-colors group-hover:text-saffron-600 dark:group-hover:text-saffron-300">
              {recipe.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{recipe.description}</p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatMinutes(recipe.totalMinutes)}
            </span>
            <span className="flex items-center gap-1.5 capitalize">
              <Gauge className="h-4 w-4" />
              {recipe.difficulty}
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-tomato-400" />
              {recipe.macros.calories} kcal
            </span>
          </div>

          <MacroBars protein={recipe.macros.protein} carbs={recipe.macros.carbs} fat={recipe.macros.fat} />

          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {missing.length === 0 ? (
              <Badge tone="herb">
                <Check className="h-3 w-3" /> You have everything
              </Badge>
            ) : (
              <>
                <Badge tone="saffron">
                  <ShoppingCart className="h-3 w-3" /> Need {missing.length}
                </Badge>
                {missing.slice(0, 3).map((m) => (
                  <Badge key={m.name}>{m.name}</Badge>
                ))}
                {missing.length > 3 && <Badge>+{missing.length - 3}</Badge>}
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function RecipeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="shimmer-bg h-40 animate-shimmer" />
      <div className="space-y-3 p-5">
        <div className="shimmer-bg h-5 w-3/4 animate-shimmer rounded-lg" />
        <div className="shimmer-bg h-4 w-full animate-shimmer rounded-lg" />
        <div className="shimmer-bg h-4 w-2/3 animate-shimmer rounded-lg" />
        <div className="shimmer-bg h-2 w-full animate-shimmer rounded-full" />
      </div>
    </div>
  );
}
