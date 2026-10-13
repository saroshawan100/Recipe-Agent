import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChefHat, ShoppingBasket, Sparkles } from "lucide-react";
import type { RecipeSummary, SuggestResponse } from "@/api/types";
import { RecipeCard, RecipeCardSkeleton } from "@/components/recipe/RecipeCard";
import { ChefThinking } from "./ChefThinking";

const THINKING = [
  "Raiding your pantry...",
  "Pairing flavors that love each other...",
  "Checking what you'd need to pick up...",
  "Counting calories and macros...",
  "Picking dishes a beginner can nail...",
];

export function ResultsLoading() {
  return (
    <section className="space-y-6">
      <ChefThinking messages={THINKING} className="glass rounded-3xl p-5" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <RecipeCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

function Group({ icon, title, subtitle, recipes }: { icon: ReactNode; title: string; subtitle: string; recipes: RecipeSummary[] }) {
  if (!recipes.length) return null;
  return (
    <div>
      <div className="mb-4 flex items-end gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">{icon}</span>
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {recipes.map((r, i) => (
          <RecipeCard key={r.id} recipe={r} index={i} />
        ))}
      </div>
    </div>
  );
}

export function Results({ results }: { results: SuggestResponse }) {
  const empty = results.makeNow.length + results.quickShop.length === 0;
  return (
    <section className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass flex items-start gap-4 rounded-3xl p-5"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-stone-950">
          <ChefHat className="h-6 w-6" />
        </span>
        <div>
          <div className="text-xs font-semibold tracking-wider text-saffron-600 uppercase dark:text-saffron-300">Chef's note</div>
          <p className="mt-1 text-[15px] leading-relaxed">{results.chefNote}</p>
        </div>
      </motion.div>

      {empty && <p className="text-center text-muted">The chef came up empty. Try adding a few more ingredients or loosening your filters.</p>}

      <Group
        icon={<Sparkles className="h-5 w-5 text-herb-500" />}
        title="Make it now"
        subtitle="Everything you need is already in your kitchen."
        recipes={results.makeNow}
      />
      <Group
        icon={<ShoppingBasket className="h-5 w-5 text-saffron-500" />}
        title="Worth a quick shop"
        subtitle="Grab a few things and unlock these."
        recipes={results.quickShop}
      />
    </section>
  );
}
