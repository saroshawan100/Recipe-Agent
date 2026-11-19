import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSetTasteTagRemoved } from "@/api/hooks";
import type { TasteProfile, TasteTagSignal } from "@/api/types";
import { Button } from "@/components/ui/button";
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
  const setRemoved = useSetTasteTagRemoved();

  const toggle = (key: "likedTags" | "avoidedTags", signal: TasteTagSignal, enabled: boolean) => {
    const current = selected[key];
    onChange({
      ...selected,
      [key]: enabled ? [...current, signal] : current.filter((item) => item.tag !== signal.tag),
    });
  };

  const removeTag = (tag: string) =>
    setRemoved.mutate(
      { tag, removed: true },
      {
        onSuccess: () => toast.success(`Removed “${tag}” from your taste profile`),
        onError: (error) => toast.error("Couldn't remove this tag", { description: error.message }),
      },
    );

  const restoreTag = (tag: string) =>
    setRemoved.mutate(
      { tag, removed: false },
      {
        onSuccess: () => toast.success(`Restored “${tag}” to your taste profile`),
        onError: (error) => toast.error("Couldn't restore this tag", { description: error.message }),
      },
    );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Taste preferences</h2>
          <p className="mt-1 text-sm text-muted">
            Uncheck a tag to skip it for this recommendation. Use the remove button to hide it from your taste profile. Tags need feedback on 3 distinct recipes; Favor starts at +0.25 and De-emphasize at −0.50.
          </p>
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
            removing={setRemoved.isPending}
            onToggle={(tag, checked) => toggle("likedTags", tag, checked)}
            onRemove={removeTag}
          />
          <TagList
            title="Avoid"
            tags={available.avoidedTags}
            selected={new Set(selected.avoidedTags.map((item) => item.tag))}
            accent="accent-tomato-600"
            emptyText="No avoided tags selected"
            removing={setRemoved.isPending}
            onToggle={(tag, checked) => toggle("avoidedTags", tag, checked)}
            onRemove={removeTag}
          />
        </div>
      )}
      {available.removedTags.length > 0 && (
        <details className="mt-4 rounded-xl border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-muted">Removed tags ({available.removedTags.length})</summary>
          <div className="mt-2 divide-y divide-line">
            {available.removedTags.map((tag) => (
              <div key={tag} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 break-words">{tag}</span>
                <Button type="button" size="sm" variant="ghost" disabled={setRemoved.isPending} onClick={() => restoreTag(tag)} aria-label={`Restore ${tag}`}>
                  <RotateCcw className="h-4 w-4" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </details>
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
  removing,
  onToggle,
  onRemove,
}: {
  title: string;
  tags: TasteTagSignal[];
  selected: Set<string>;
  accent: string;
  emptyText: string;
  removing: boolean;
  onToggle: (tag: TasteTagSignal, checked: boolean) => void;
  onRemove: (tag: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {tags.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{emptyText}</p>
      ) : (
        <div className="space-y-1 rounded-xl bg-surface-2 p-2">
          {tags.map((signal) => (
            <div key={signal.tag} className="flex items-start gap-1 rounded-lg px-2 py-1 hover:bg-surface">
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 py-1 text-sm">
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
              <button
                type="button"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-tomato-500/10 hover:text-tomato-600"
                onClick={() => onRemove(signal.tag)}
                disabled={removing}
                aria-label={`Remove ${signal.tag} from taste profile`}
                title="Remove from taste profile"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
