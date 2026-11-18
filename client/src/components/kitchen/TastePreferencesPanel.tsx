import type { TasteProfile, TasteTagSignal } from "@/api/types";
import { Card } from "@/components/ui/primitives";

export function TastePreferencesPanel({
  available,
  selected,
  onChange,
  loading,
}: {
  available: TasteProfile;
  selected: TasteProfile;
  onChange: (profile: TasteProfile) => void;
  loading: boolean;
}) {
  const toggle = (key: "likedTags" | "avoidedTags", signal: TasteTagSignal, enabled: boolean) => {
    const current = selected[key];
    onChange({
      ...selected,
      [key]: enabled ? [...current, signal] : current.filter((item) => item.tag !== signal.tag),
    });
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Taste preferences</h2>
          <p className="mt-1 text-sm text-muted">Your saved feedback starts selected. Uncheck tags to explore beyond your usual tastes.</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">Optional</span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading your taste preferences…</p>
      ) : available.likedTags.length === 0 && available.avoidedTags.length === 0 ? (
        <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm text-muted">No learned tags yet. Rate recipes to build your taste profile. You can still get recommendations without it.</p>
      ) : (
        <div className="mt-4 grid gap-5">
          <TagList
            title="Favor"
            tags={available.likedTags}
            selected={new Set(selected.likedTags.map((item) => item.tag))}
            accent="accent-herb-600"
            emptyText="No liked tags selected"
            onToggle={(tag, checked) => toggle("likedTags", tag, checked)}
          />
          <TagList
            title="De-emphasize"
            tags={available.avoidedTags}
            selected={new Set(selected.avoidedTags.map((item) => item.tag))}
            accent="accent-tomato-600"
            emptyText="No avoided tags selected"
            onToggle={(tag, checked) => toggle("avoidedTags", tag, checked)}
          />
        </div>
      )}
    </Card>
  );
}

function TagList({
  title,
  tags,
  selected,
  accent,
  emptyText,
  onToggle,
}: {
  title: string;
  tags: TasteTagSignal[];
  selected: Set<string>;
  accent: string;
  emptyText: string;
  onToggle: (tag: TasteTagSignal, checked: boolean) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {tags.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{emptyText}</p>
      ) : (
        <div className="space-y-1 rounded-xl bg-surface-2 p-2">
          {tags.map((signal) => (
            <label key={signal.tag} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface">
              <input
                type="checkbox"
                className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`}
                checked={selected.has(signal.tag)}
                onChange={(event) => onToggle(signal, event.target.checked)}
              />
              <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug" title={signal.tag}>{signal.tag}</span>
              <span className="shrink-0 text-right text-xs tabular-nums text-muted" title={`Based on ${signal.distinctRecipes} distinct recipes`}>
                {signal.score > 0 ? "+" : ""}{signal.score.toFixed(2)} · {signal.distinctRecipes}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
