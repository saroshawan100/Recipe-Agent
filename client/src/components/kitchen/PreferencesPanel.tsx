import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Clock, Flame, ShoppingCart, SlidersHorizontal, Users } from "lucide-react";
import type { Preferences } from "@/api/types";
import { Card, Chip, Segmented, SectionLabel, Slider, Stepper } from "@/components/ui/primitives";
import { ALLERGIES, CUISINES, DIETS, EQUIPMENT, STAPLE_OPTIONS } from "@/data/ingredients";
import { cn } from "@/lib/utils";
import { useKitchenStore } from "@/store/useKitchenStore";

function toggleIn(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function PreferencesPanel() {
  const prefs = useKitchenStore((s) => s.prefs);
  const setPrefs = useKitchenStore((s) => s.setPrefs);
  const staples = useKitchenStore((s) => s.staples);
  const setStaples = useKitchenStore((s) => s.setStaples);
  const [more, setMore] = useState(false);
  const [customAllergy, setCustomAllergy] = useState("");

  const activeExtras =
    prefs.diets.length + prefs.allergies.length + prefs.cuisines.length + prefs.equipment.length + (prefs.calorieTarget ? 1 : 0) + (prefs.proteinTarget ? 1 : 0);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-saffron-500" />
        <h2 className="text-lg font-semibold">Preferences</h2>
      </div>

      <div className="space-y-5">
        <div>
          <SectionLabel>Shopping</SectionLabel>
          <Segmented<Preferences["mode"]>
            value={prefs.mode}
            onChange={(mode) => setPrefs({ mode })}
            options={[
              { value: "haveOnly", label: "Only what I have" },
              { value: "quickShop", label: "Open to a quick shop" },
            ]}
          />
          <AnimatePresence initial={false}>
            {prefs.mode === "quickShop" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 flex items-center gap-3">
                  <ShoppingCart className="h-4 w-4 shrink-0 text-muted" />
                  <Slider label="Max extra items" value={prefs.maxExtras} onChange={(maxExtras) => setPrefs({ maxExtras })} min={1} max={8} />
                  <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">up to {prefs.maxExtras}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <SectionLabel>
              <Users className="mr-1 inline h-3.5 w-3.5" />
              Servings
            </SectionLabel>
            <Stepper value={prefs.servings} onChange={(servings) => setPrefs({ servings })} label="servings" />
          </div>
          <div>
            <SectionLabel>Skill</SectionLabel>
            <select
              value={prefs.skill}
              onChange={(e) => setPrefs({ skill: e.target.value as Preferences["skill"] })}
              className="h-9 w-full cursor-pointer rounded-xl border-0 bg-surface-2 px-3 text-sm font-medium outline-none"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div>
          <SectionLabel>
            <Clock className="mr-1 inline h-3.5 w-3.5" />
            Max time
          </SectionLabel>
          <div className="flex items-center gap-3">
            <Slider label="Max cooking time" value={prefs.maxMinutes ?? 125} onChange={(v) => setPrefs({ maxMinutes: v >= 125 ? null : v })} min={10} max={125} step={5} />
            <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">{prefs.maxMinutes ? `${prefs.maxMinutes} min` : "Any"}</span>
          </div>
        </div>

        <button
          onClick={() => setMore((m) => !m)}
          className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-surface-2/70 px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-2"
        >
          <span>
            Diet, allergies, cuisine & more
            {activeExtras > 0 && <span className="ml-2 rounded-full bg-saffron-500 px-2 py-0.5 text-xs text-stone-950">{activeExtras}</span>}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", more && "rotate-180")} />
        </button>

        <AnimatePresence initial={false}>
          {more && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-5 overflow-hidden">
              <ChipGroup label="Diet">
                {DIETS.map((d) => (
                  <Chip key={d} active={prefs.diets.includes(d)} onClick={() => setPrefs({ diets: toggleIn(prefs.diets, d) })} tone="herb">
                    {d}
                  </Chip>
                ))}
              </ChipGroup>

              <ChipGroup label="Allergies (strictly avoided)">
                {[...ALLERGIES, ...prefs.allergies.filter((a) => !ALLERGIES.includes(a))].map((a) => (
                  <Chip key={a} active={prefs.allergies.includes(a)} onClick={() => setPrefs({ allergies: toggleIn(prefs.allergies, a) })} tone="tomato">
                    {a}
                  </Chip>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = customAllergy.trim();
                    if (v && !prefs.allergies.includes(v)) setPrefs({ allergies: [...prefs.allergies, v] });
                    setCustomAllergy("");
                  }}
                >
                  <input
                    value={customAllergy}
                    onChange={(e) => setCustomAllergy(e.target.value)}
                    placeholder="+ other"
                    className="h-[34px] w-24 rounded-full border border-dashed border-line bg-transparent px-3 text-sm outline-none focus:w-36 focus:border-tomato-500"
                  />
                </form>
              </ChipGroup>

              <ChipGroup label="Cuisine">
                {CUISINES.map((c) => (
                  <Chip key={c} active={prefs.cuisines.includes(c)} onClick={() => setPrefs({ cuisines: toggleIn(prefs.cuisines, c) })}>
                    {c}
                  </Chip>
                ))}
              </ChipGroup>

              <ChipGroup label="Equipment I have (leave empty for a standard kitchen)">
                {EQUIPMENT.map((eq) => (
                  <Chip key={eq} active={prefs.equipment.includes(eq)} onClick={() => setPrefs({ equipment: toggleIn(prefs.equipment, eq) })}>
                    {eq}
                  </Chip>
                ))}
              </ChipGroup>

              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Calories / serving"
                  icon={<Flame className="h-3.5 w-3.5" />}
                  value={prefs.calorieTarget}
                  onChange={(calorieTarget) => setPrefs({ calorieTarget })}
                  placeholder="e.g. 600"
                  min={100}
                  max={3000}
                />
                <NumberField
                  label="Min protein (g)"
                  value={prefs.proteinTarget}
                  onChange={(proteinTarget) => setPrefs({ proteinTarget })}
                  placeholder="e.g. 40"
                  min={5}
                  max={300}
                />
              </div>

              <ChipGroup label="Basics I always have">
                {STAPLE_OPTIONS.map((s) => (
                  <Chip key={s} active={staples.includes(s)} onClick={() => setStaples(toggleIn(staples, s))} tone="herb" className="capitalize">
                    {s}
                  </Chip>
                ))}
              </ChipGroup>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <SectionLabel>Anything else?</SectionLabel>
          <textarea
            value={prefs.notes}
            onChange={(e) => setPrefs({ notes: e.target.value.slice(0, 500) })}
            rows={2}
            placeholder="Something spicy and cozy, kid-friendly, meal-prep for the week..."
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-saffron-500"
          />
        </div>
      </div>
    </Card>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label: string;
  icon?: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <SectionLabel className="flex items-center gap-1">
        {icon}
        {label}
      </SectionLabel>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? n : null);
        }}
        onBlur={() => {
          if (value !== null) onChange(Math.min(max, Math.max(min, value)));
        }}
        className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-saffron-500"
      />
    </label>
  );
}
