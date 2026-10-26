import { useMemo, useRef, useState } from "react";
import { Camera, Check, Clock, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useScanPhoto } from "@/api/hooks";
import type { ScannedItem } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlays";
import { Badge } from "@/components/ui/primitives";
import { CATALOG } from "@/data/ingredients";
import { cn } from "@/lib/utils";
import { resizeImage } from "@/lib/resizeImage";
import { useKitchenStore } from "@/store/useKitchenStore";
import { IngredientImage } from "./IngredientImage";
import { matchIngredient } from "./IngredientPicker";

const KNOWN_NAMES = CATALOG.map((i) => i.name);

const CONFIDENCE_TONE = { high: "herb", medium: "saffron", low: "neutral" } as const;

/** Matches each scanned name to a pantry ingredient, dropping names that resolve to the same one. */
function resolveScan(items: ScannedItem[]) {
  const seen = new Set<string>();
  return items
    .map((item) => ({ item, ingredient: matchIngredient(item.name) }))
    .filter(({ ingredient }) => !seen.has(ingredient.key) && seen.add(ingredient.key));
}

/** "Scan a photo" button: sends a fridge/pantry photo to the chef and lets the cook pick which items to add. */
export function PhotoScan() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [manualItems, setManualItems] = useState<ReturnType<typeof matchIngredient>[]>([]);
  const [manualInput, setManualInput] = useState("");
  const selected = useKitchenStore((s) => s.selected);
  const add = useKitchenStore((s) => s.add);
  const scan = useScanPhoto();

  const inPantry = useMemo(() => new Set(selected.map((s) => s.key)), [selected]);
  // Resolve each scanned name once so the list shows the same photo/name that will be added.
  const resolved = useMemo(() => resolveScan(scan.data?.items ?? []), [scan.data]);

  const onFile = async (file: File | undefined, input: HTMLInputElement) => {
    input.value = "";
    if (!file) return;
    let image: string;
    try {
      image = await resizeImage(file);
    } catch (e) {
      toast.error("Couldn't use that photo", { description: (e as Error).message });
      return;
    }
    setPreview(image);
    setPicked(new Set());
    setManualItems([]);
    setManualInput("");
    setOpen(true);
    scan.mutate(
      { image, knownNames: KNOWN_NAMES },
      {
        onSuccess: (data) => {
          const keys = resolveScan(data.items)
            .filter(({ item, ingredient }) => item.confidence !== "low" && !inPantry.has(ingredient.key))
            .map(({ ingredient }) => ingredient.key);
          setPicked(new Set(keys));
        },
      },
    );
  };

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const addPicked = () => {
    const chosen = resolved.filter(({ ingredient }) => picked.has(ingredient.key) && !inPantry.has(ingredient.key));
    const additions = new Map<string, ReturnType<typeof matchIngredient> & { quantity?: string; useSoon?: boolean }>();
    for (const { item, ingredient } of chosen) {
      additions.set(ingredient.key, { ...ingredient, quantity: item.quantity ?? undefined, useSoon: item.useSoon || undefined });
    }
    for (const ingredient of manualItems) {
      if (!inPantry.has(ingredient.key)) additions.set(ingredient.key, ingredient);
    }
    for (const ingredient of additions.values()) {
      add(ingredient);
    }
    const total = additions.size;
    toast.success(`Added ${total} ingredient${total === 1 ? "" : "s"} to your pantry`);
    setOpen(false);
  };

  const addManualItem = () => {
    const item = manualInput.trim().replace(/\s+/g, " ");
    if (!item) return;
    const ingredient = matchIngredient(item);
    setManualItems((prev) => prev.some((entry) => entry.key === ingredient.key) ? prev : [...prev, ingredient]);
    setManualInput("");
  };

  const removeManualItem = (key: string) => setManualItems((prev) => prev.filter((item) => item.key !== key));

  const pickedCount = resolved.filter(({ ingredient }) => picked.has(ingredient.key) && !inPantry.has(ingredient.key)).length
    + manualItems.filter((item) => !inPantry.has(item.key) && !picked.has(item.key)).length;

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0], e.currentTarget)}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0], e.currentTarget)}
      />
      <Button
        variant="outline"
        className="h-14 rounded-2xl px-3"
        onClick={() => cameraInputRef.current?.click()}
        title="Take a fridge photo"
        aria-label="Take a fridge photo"
      >
        <Camera className="h-5 w-5" />
        <span className="text-xs sm:text-sm">Take photo</span>
      </Button>
      <Button
        variant="outline"
        className="h-14 rounded-2xl px-3"
        onClick={() => uploadInputRef.current?.click()}
        title="Upload a fridge image"
        aria-label="Upload a fridge image"
      >
        <ImagePlus className="h-5 w-5" />
        <span className="text-xs sm:text-sm">Upload image</span>
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Review fridge ingredients"
        description="Uncheck anything the chef got wrong, then add items it missed before confirming."
      >
        {preview && <img src={preview} alt="Your photo" className="mb-4 max-h-48 w-full rounded-2xl object-cover" />}

        {scan.isPending && (
          <div className="flex items-center justify-center gap-3 py-8 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            The chef is taking a look...
          </div>
        )}

        {scan.isError && (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-tomato-600 dark:text-tomato-300">{scan.error.message}</p>
            <Button variant="outline" onClick={() => uploadInputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Try another photo
            </Button>
          </div>
        )}

        {scan.isSuccess && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{scan.data.note}</p>
            {resolved.length > 0 && (
              <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {resolved.map(({ item, ingredient }) => (
                  <ScanRow
                    key={ingredient.key}
                    item={item}
                    name={ingredient.name}
                    image={ingredient.image}
                    emoji={ingredient.emoji}
                    already={inPantry.has(ingredient.key)}
                    checked={picked.has(ingredient.key)}
                    onToggle={() => toggle(ingredient.key)}
                  />
                ))}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addManualItem();
              }}
            >
              <input
                value={manualInput}
                onChange={(event) => setManualInput(event.target.value)}
                placeholder="Add an ingredient the photo missed"
                aria-label="Add a missed ingredient"
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-saffron-500"
              />
              <Button type="submit" variant="outline" disabled={!manualInput.trim()} aria-label="Add ingredient">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </form>
            {manualItems.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Manually added ingredients">
                {manualItems.map((item) => (
                  <span key={item.key} className="inline-flex items-center gap-1 rounded-full border border-saffron-500/50 bg-saffron-500/10 py-1 pl-3 pr-1 text-sm">
                    {item.name}
                    <button type="button" onClick={() => removeManualItem(item.key)} aria-label={`Remove ${item.name}`} className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => uploadInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Another photo
              </Button>
              <Button onClick={addPicked} disabled={pickedCount === 0}>
                Add {pickedCount || ""} to pantry
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function ScanRow({
  item,
  name,
  image,
  emoji,
  already,
  checked,
  onToggle,
}: {
  item: ScannedItem;
  name: string;
  image: string | null | undefined;
  emoji: string | undefined;
  already: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const on = already || checked;
  return (
    <li>
      <button
        onClick={onToggle}
        disabled={already}
        aria-pressed={on}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-default disabled:opacity-60",
          on ? "border-saffron-500/60 bg-saffron-500/10" : "border-line hover:border-saffron-500/40",
        )}
      >
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
            on ? "border-saffron-500 bg-saffron-500 text-stone-950" : "border-line",
          )}
        >
          {on && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        <IngredientImage src={image} emoji={emoji} alt="" className="h-8 w-8" emojiClassName="h-8 w-8 text-xl" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          {(item.quantity || already) && (
            <span className="block truncate text-xs text-muted">{already ? "Already in your pantry" : item.quantity}</span>
          )}
        </span>
        {item.useSoon && <Clock className="h-4 w-4 shrink-0 text-tomato-500" aria-label="Use soon" />}
        <Badge tone={CONFIDENCE_TONE[item.confidence]}>{item.confidence === "high" ? "sure" : item.confidence === "medium" ? "likely" : "unsure"}</Badge>
      </button>
    </li>
  );
}
