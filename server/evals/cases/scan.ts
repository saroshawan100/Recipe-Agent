import fs from "node:fs";
import path from "node:path";
import { ScanResult } from "../../src/schemas/recipe.js";
import { EVALS_DIR, check, defineCase, tokens, warn } from "../lib.js";

/**
 * Photo-scan cases are built from your own photos: put `fridge.jpg` next to
 * `fridge.json` in evals/fixtures/scan/ (see README). No photos -> no scan cases.
 */
const SCAN_DIR = path.join(EVALS_DIR, "fixtures", "scan");
const MIME: Record<string, string> = { ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp" };

interface ScanExpectation {
  /** Ingredients that are clearly visible. Recall is measured against these. */
  expected: string[];
  /** Things that are NOT in the photo (or are non-food) and must not be listed. */
  forbidden?: string[];
  /** Minimum share of `expected` that must be found. Default 0.6. */
  minRecall?: number;
  /** The photo has no food: items must be empty. */
  empty?: boolean;
}

const matches = (name: string, target: string) => {
  const a = new Set(tokens(name));
  return tokens(target).some((t) => a.has(t));
};

function loadScanCases() {
  if (!fs.existsSync(SCAN_DIR)) return [];
  return fs
    .readdirSync(SCAN_DIR)
    .filter((f) => MIME[path.extname(f).toLowerCase()])
    .map((file) => {
      const name = path.basename(file, path.extname(file));
      const specPath = path.join(SCAN_DIR, `${name}.json`);
      const spec: ScanExpectation | null = fs.existsSync(specPath) ? JSON.parse(fs.readFileSync(specPath, "utf8")) : null;
      return defineCase<ScanResult>({
        id: `scan/${name}`,
        stage: "scan",
        description: `Photo scan of ${file}`,
        skip: () => {
          if (!spec) return `missing ${name}.json`;
          return fs.statSync(path.join(SCAN_DIR, file)).size > 2_900_000 ? "photo is over ~2.9 MB; resize it to about 1600px wide" : null;
        },
        schema: ScanResult,
        run: (api) => {
          const b64 = fs.readFileSync(path.join(SCAN_DIR, file)).toString("base64");
          return api.post("/ai/scan", { image: `data:image/${MIME[path.extname(file).toLowerCase()]};base64,${b64}`, knownNames: [] });
        },
        checks: (r) => {
          const s = spec!;
          if (s.empty) return [check("no items for a photo without food", r.items.length === 0, r.items.map((i) => i.name).join(", ")), check("note explains why", r.note.length > 10)];
          const found = s.expected.filter((e) => r.items.some((i) => matches(i.name, e)));
          const recall = s.expected.length ? found.length / s.expected.length : 1;
          const bad = (s.forbidden ?? []).filter((f) => r.items.some((i) => matches(i.name, f)));
          const names = r.items.map((i) => i.name.toLowerCase());
          return [
            check(`recall >= ${Math.round((s.minRecall ?? 0.6) * 100)}%`, recall >= (s.minRecall ?? 0.6), `found ${found.length}/${s.expected.length}; missed ${s.expected.filter((e) => !found.includes(e)).join(", ")}`),
            check("lists nothing forbidden", bad.length === 0, bad.join(", ")),
            check("no duplicate names", new Set(names).size === names.length),
            warn("precision: most items are expected", r.items.filter((i) => s.expected.some((e) => matches(i.name, e))).length >= r.items.length * 0.7, `extra: ${r.items.filter((i) => !s.expected.some((e) => matches(i.name, e))).map((i) => i.name).join(", ")}`),
          ];
        },
      });
    });
}

export const scanCases = loadScanCases();
