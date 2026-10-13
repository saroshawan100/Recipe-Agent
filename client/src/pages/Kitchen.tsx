import { useRef } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowRight, ChefHat, Flame, ListChecks, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { useSuggest } from "@/api/hooks";
import { IngredientImage } from "@/components/kitchen/IngredientImage";
import { IngredientPicker } from "@/components/kitchen/IngredientPicker";
import { PantryTray } from "@/components/kitchen/PantryTray";
import { PreferencesPanel } from "@/components/kitchen/PreferencesPanel";
import { Results, ResultsLoading } from "@/components/kitchen/Results";
import { Button } from "@/components/ui/button";
import { useKitchenStore } from "@/store/useKitchenStore";

const FEATURES = [
  { icon: ChefHat, label: "Recipes from what you have" },
  { icon: ShoppingBasket, label: "Smart shopping lists" },
  { icon: Flame, label: "Calories & macros" },
  { icon: ListChecks, label: "Live step-by-step coaching" },
];

export function Kitchen() {
  const selected = useKitchenStore((s) => s.selected);
  const staples = useKitchenStore((s) => s.staples);
  const prefs = useKitchenStore((s) => s.prefs);
  const results = useKitchenStore((s) => s.results);
  const setResults = useKitchenStore((s) => s.setResults);
  const suggest = useSuggest();
  const resultsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaInView = useInView(ctaRef);
  const resultsInView = useInView(resultsRef, { margin: "0px 0px -40% 0px" });
  const showFloatingCta = selected.length > 0 && !ctaInView && !resultsInView;

  const scrollToResults = () =>
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  const onSuggest = () => {
    if (!selected.length) {
      toast.info("Add a few ingredients first", { description: "Tap the pictures or type what you have." });
      return;
    }
    scrollToResults();
    suggest.mutate(
      {
        ingredients: selected.map((s) => ({ name: s.name, category: s.category, quantity: s.quantity || undefined, useSoon: s.useSoon || undefined })),
        staples,
        preferences: prefs,
      },
      {
        onSuccess: (data) => {
          setResults(data);
          scrollToResults();
        },
        onError: (e) => toast.error("The chef hit a snag", { description: e.message }),
      },
    );
  };

  return (
    <div className="space-y-10">
      <section className="pt-4">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl text-4xl leading-[1.1] font-semibold sm:text-5xl lg:text-6xl"
        >
          What's in your <span className="bg-gradient-to-r from-saffron-400 to-tomato-500 bg-clip-text text-transparent italic">kitchen</span> tonight?
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-4 max-w-2xl text-lg text-muted">
          Pick what you've got. Your AI chef will find recipes you can make right now, what's worth a quick shop, and then
          coach you through every step.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }} className="mt-5 flex flex-wrap gap-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5 text-sm text-muted">
              <Icon className="h-4 w-4 text-saffron-500" />
              {label}
            </span>
          ))}
        </motion.div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <IngredientPicker />
        <div className="space-y-6">
          <PantryTray />
          <PreferencesPanel />
          <div ref={ctaRef}>
            <SuggestButton onClick={onSuggest} pending={suggest.isPending} />
          </div>
        </div>
      </div>

      <div ref={resultsRef} className="scroll-mt-24">
        {suggest.isPending ? <ResultsLoading /> : results ? <Results results={results} /> : null}
      </div>

      <AnimatePresence>
        {showFloatingCta && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4"
          >
            <div className="glass pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl p-2 pl-4 shadow-2xl shadow-black/30">
              <div className="flex -space-x-2">
                {selected.slice(0, 3).map((s) => (
                  <span key={s.key} className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border-2 border-surface bg-surface-2">
                    <IngredientImage src={s.image} emoji={s.emoji} alt="" className="h-6 w-6" emojiClassName="text-sm" />
                  </span>
                ))}
              </div>
              <div className="text-sm leading-tight">
                <span className="font-semibold">{selected.length}</span>
                <span className="block text-xs text-muted">ingredients</span>
              </div>
              <SuggestButton onClick={onSuggest} pending={suggest.isPending} className="h-12 flex-1 text-base" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SuggestButton({ onClick, pending, className }: { onClick: () => void; pending: boolean; className?: string }) {
  return (
    <Button size="xl" className={className ?? "w-full"} onClick={onClick} loading={pending}>
      {pending ? "Cooking up ideas..." : "What can I make?"}
      {!pending && <ArrowRight className="h-5 w-5" />}
    </Button>
  );
}
