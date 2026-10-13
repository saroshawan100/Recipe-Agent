import { Fragment } from "react";
import { AlertTriangle, ArrowRightLeft, Check, Clock, Eye, Lightbulb, Package, Refrigerator, ShoppingCart, Utensils } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { RecipeDetails } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Badge, Card, Stepper } from "@/components/ui/primitives";
import { cn, formatClock, formatQuantity } from "@/lib/utils";
import { GlossaryText } from "./GlossaryText";

export function IngredientsTab({
  details,
  servings,
  onServingsChange,
  onAddMissing,
  adding,
}: {
  details: RecipeDetails;
  servings: number;
  onServingsChange: (n: number) => void;
  onAddMissing: () => void;
  adding: boolean;
}) {
  const scale = servings / details.servings;
  const have = details.ingredients.filter((i) => i.have);
  const need = details.ingredients.filter((i) => !i.have);

  const Row = ({ ing, tone }: { ing: RecipeDetails["ingredients"][number]; tone: "have" | "need" }) => (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
          tone === "have" ? "bg-herb-500/15 text-herb-600 dark:text-herb-300" : "bg-saffron-500/15 text-saffron-600 dark:text-saffron-300",
        )}
      >
        {tone === "have" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <ShoppingCart className="h-3.5 w-3.5" />}
      </span>
      <div className="flex-1">
        <span className="font-semibold tabular-nums">{formatQuantity(ing.amount, ing.unit, scale)}</span>{" "}
        <span>{ing.name}</span>
        {ing.preparation && <span className="text-muted">, {ing.preparation}</span>}
        {ing.optional && <Badge className="ml-2">optional</Badge>}
      </div>
    </li>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">Ingredients</h3>
          <div className="flex items-center gap-2 text-sm text-muted">
            Servings <Stepper value={servings} onChange={onServingsChange} min={1} max={24} label="servings" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-1 text-sm font-semibold text-herb-600 dark:text-herb-300">You have ({have.length})</div>
            <ul className="divide-y divide-line">
              {have.map((ing) => (
                <Row key={ing.name} ing={ing} tone="have" />
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-saffron-600 dark:text-saffron-300">You need ({need.length})</div>
            {need.length ? (
              <>
                <ul className="divide-y divide-line">
                  {need.map((ing) => (
                    <Row key={ing.name} ing={ing} tone="need" />
                  ))}
                </ul>
                <Button variant="outline" size="sm" className="mt-3" onClick={onAddMissing} loading={adding}>
                  <ShoppingCart className="h-4 w-4" /> Add to shopping list
                </Button>
              </>
            ) : (
              <p className="py-2.5 text-sm text-muted">Nothing! You're all set. 🎉</p>
            )}
          </div>
        </div>
      </Card>
      <Card className="h-fit p-6">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Utensils className="h-5 w-5 text-saffron-500" /> Equipment
        </h3>
        <ul className="space-y-2 text-sm">
          {details.equipment.map((e) => (
            <li key={e} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
              {e}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const PHASE_TONE = { prep: "neutral", cook: "saffron", finish: "herb" } as const;

export function StepsTab({ details }: { details: RecipeDetails }) {
  return (
    <ol className="space-y-4">
      {details.steps.map((step, i) => (
        <li key={i}>
          <Card className="flex gap-4 p-5 sm:gap-5 sm:p-6">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-fg font-display text-lg font-semibold text-bg">{i + 1}</span>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <Badge tone={PHASE_TONE[step.phase]} className="capitalize">
                  {step.phase}
                </Badge>
                {step.timerSeconds && (
                  <Badge tone="tomato">
                    <Clock className="h-3 w-3" /> {formatClock(step.timerSeconds)}
                  </Badge>
                )}
              </div>
              <p className="leading-relaxed">
                <GlossaryText text={step.instruction} glossary={details.glossary} />
              </p>
              {step.donenessCue && (
                <div className="flex gap-2 rounded-xl bg-herb-500/10 px-3 py-2 text-sm">
                  <Eye className="mt-0.5 h-4 w-4 shrink-0 text-herb-600 dark:text-herb-300" />
                  <span>
                    <span className="font-semibold">Done when: </span>
                    {step.donenessCue}
                  </span>
                </div>
              )}
              {step.tip && (
                <div className="flex gap-2 rounded-xl bg-saffron-500/10 px-3 py-2 text-sm">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600 dark:text-saffron-300" />
                  <span>
                    <span className="font-semibold">Chef's tip: </span>
                    {step.tip}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}

const MACRO_COLORS = { protein: "#5aa457", carbs: "#f4a300", fat: "#f2775f" };

export function NutritionTab({ details, calorieTarget }: { details: RecipeDetails; calorieTarget: number | null }) {
  const n = details.nutrition;
  const data = [
    { name: "Protein", key: "protein", grams: n.protein, kcal: n.protein * 4 },
    { name: "Carbs", key: "carbs", grams: n.carbs, kcal: n.carbs * 4 },
    { name: "Fat", key: "fat", grams: n.fat, kcal: n.fat * 9 },
  ] as const;
  const totalKcal = data.reduce((s, d) => s + d.kcal, 0) || 1;
  const rows: [string, string][] = [
    ["Calories", `${Math.round(n.calories)} kcal`],
    ["Protein", `${Math.round(n.protein)} g`],
    ["Carbohydrates", `${Math.round(n.carbs)} g`],
    ["Fat", `${Math.round(n.fat)} g`],
    ["Fiber", `${Math.round(n.fiber)} g`],
    ["Sugar", `${Math.round(n.sugar)} g`],
    ["Sodium", `${Math.round(n.sodiumMg)} mg`],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h3 className="text-xl font-semibold">Macros per serving</h3>
        <div className="relative mx-auto mt-2 h-64 max-w-xs">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={[...data]} dataKey="kcal" innerRadius="68%" outerRadius="95%" paddingAngle={3} stroke="none" startAngle={90} endAngle={-270}>
                {data.map((d) => (
                  <Cell key={d.key} fill={MACRO_COLORS[d.key]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-display text-4xl font-semibold">{Math.round(n.calories)}</div>
              <div className="text-sm text-muted">kcal / serving</div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {data.map((d) => (
            <div key={d.key} className="rounded-2xl bg-surface-2 p-3 text-center">
              <div className="mx-auto mb-1 h-2 w-8 rounded-full" style={{ background: MACRO_COLORS[d.key] }} />
              <div className="text-lg font-semibold tabular-nums">{Math.round(d.grams)}g</div>
              <div className="text-xs text-muted">
                {d.name} · {Math.round((d.kcal / totalKcal) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="text-xl font-semibold">Nutrition facts</h3>
        <p className="text-sm text-muted">Per serving · AI estimate</p>
        {calorieTarget && (
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span>Your target: {calorieTarget} kcal</span>
              <span className="font-semibold">{Math.round((n.calories / calorieTarget) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full", n.calories > calorieTarget * 1.15 ? "bg-tomato-500" : "bg-herb-500")}
                style={{ width: `${Math.min(100, (n.calories / calorieTarget) * 100)}%` }}
              />
            </div>
          </div>
        )}
        <dl className="mt-4 divide-y divide-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between py-2.5">
              <dt className="text-muted">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

export function TipsTab({ details }: { details: RecipeDetails }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {details.substitutions.length > 0 && (
        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <ArrowRightLeft className="h-5 w-5 text-saffron-500" /> Substitutions
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {details.substitutions.map((s, i) => (
              <div key={i} className="rounded-2xl bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  {s.ingredient} <ArrowRightLeft className="h-3.5 w-3.5 text-muted" /> <span className="text-saffron-600 dark:text-saffron-300">{s.swap}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{s.note}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      {details.safetyNotes.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-3 flex items-center gap-2 text-xl font-semibold">
            <AlertTriangle className="h-5 w-5 text-tomato-500" /> Food safety
          </h3>
          <ul className="space-y-2 text-sm leading-relaxed">
            {details.safetyNotes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-tomato-500" />
                {n}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="space-y-5 p-6">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xl font-semibold">
            <Refrigerator className="h-5 w-5 text-herb-500" /> Storage & leftovers
          </h3>
          <p className="text-sm leading-relaxed">{details.storage}</p>
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xl font-semibold">
            <Package className="h-5 w-5 text-saffron-500" /> Serve it with
          </h3>
          <p className="text-sm leading-relaxed">{details.servingSuggestion}</p>
        </div>
      </Card>
      {details.glossary.length > 0 && (
        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-xl font-semibold">Kitchen glossary</h3>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {details.glossary.map((g) => (
              <Fragment key={g.term}>
                <div>
                  <dt className="font-semibold capitalize">{g.term}</dt>
                  <dd className="text-sm text-muted">{g.definition}</dd>
                </div>
              </Fragment>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
