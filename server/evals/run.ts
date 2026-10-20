/**
 * Pantry Chef agent evals. Runs each case against a running server, scores it with
 * deterministic checks plus an optional LLM judge, and writes a JSON report.
 *
 *   npm run eval                         all cases (needs `npm run dev`; makes billed OpenAI calls)
 *   npm run eval -- --dry                validate fixtures + self-test the checkers, no API calls
 *   npm run eval -- --stage suggest,chat only these stages
 *   npm run eval -- --case allergy       only cases whose id contains "allergy"
 *   npm run eval -- --repeat 3           run each case 3 times to measure flakiness
 *   npm run eval -- --no-judge           skip the LLM judge (cheaper)
 *   npm run eval -- --verbose            print every check and the raw output
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { violation } from "../src/lib/dietGuard.js";
import { RecipeDetails, type Preferences, type RecipeCard } from "../src/schemas/recipe.js";
import { askCases, checkinCases, coachCases, coachingNegativeCases } from "./cases/coaching.js";
import { chatCases } from "./cases/chat.js";
import { detailsCases } from "./cases/details.js";
import { scanCases } from "./cases/scan.js";
import { suggestCases } from "./cases/suggest.js";
import { CHICKEN_CARD, CHICKEN_DETAILS, POTATO_DETAILS, context } from "./fixtures.js";
import {
  BASE,
  EVALS_DIR,
  LEX,
  STAGES,
  fahrenheitWithoutCelsius,
  findForbidden,
  inPantry,
  judge,
  judgeModel,
  makeApi,
  type CheckResult,
  type EvalCase,
  type JudgeResult,
  type Stage,
} from "./lib.js";

const ALL: EvalCase[] = [...suggestCases, ...detailsCases, ...coachCases, ...coachingNegativeCases, ...checkinCases, ...askCases, ...chatCases, ...scanCases];

// ---------- Args ----------

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const stages = opt("stage")?.split(",").map((s) => s.trim()) as Stage[] | undefined;
const caseFilter = opt("case");
const repeat = Math.max(1, Number(opt("repeat") ?? 1));
const concurrency = Math.max(1, Number(opt("concurrency") ?? 3));
const useJudge = !flag("no-judge");
const verbose = flag("verbose");

const bad = stages?.filter((s) => !STAGES.includes(s));
if (bad?.length) {
  console.error(`Unknown stage(s): ${bad.join(", ")}. Valid: ${STAGES.join(", ")}`);
  process.exit(2);
}

const selected = ALL.filter((c) => (!stages || stages.includes(c.stage)) && (!caseFilter || c.id.includes(caseFilter)));

// ---------- Colors ----------

const tty = process.stdout.isTTY;
const color = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = color(32), red = color(31), yellow = color(33), dim = color(2), bold = color(1);

// ---------- Dry run ----------

function selfTest() {
  // Fixtures must match the real request schemas, or every coach/check-in case would 400.
  RecipeDetails.parse(CHICKEN_DETAILS);
  RecipeDetails.parse(POTATO_DETAILS);

  // The checkers must catch violations and ignore safe phrasing, or the evals mean nothing.
  assert.deepEqual(findForbidden("crushed peanuts for garnish", LEX.peanut), ["peanuts"]);
  assert.deepEqual(findForbidden("a peanut-free sauce", LEX.peanut), []);
  assert.deepEqual(findForbidden("no peanuts, use sunflower seeds", LEX.peanut), []);
  assert.deepEqual(findForbidden("1 tbsp butter", LEX.animal), ["butter"]);
  assert.deepEqual(findForbidden("coconut milk, peanut butter, chickpeas, eggplant", LEX.animal), []);
  assert.deepEqual(findForbidden("1 tbsp fish sauce", LEX.animal).sort(), ["fish", "fish sauce"]);
  assert.deepEqual(findForbidden("soy sauce", LEX.gluten), ["soy sauce"]);
  assert.deepEqual(findForbidden("gluten-free pasta, rice noodles, tamari, corn tortillas", LEX.gluten), []);
  assert.ok(findForbidden("2 tbsp oyster sauce", LEX.shellfish).includes("oyster sauce"));
  assert.deepEqual(findForbidden("a shellfish-free stir-fry", LEX.shellfish), []);
  assert.ok(findForbidden("toasted pine nuts", LEX.treeNut).length > 0);
  assert.deepEqual(fahrenheitWithoutCelsius("cook to 165°F (74°C) then rest"), []);
  assert.equal(fahrenheitWithoutCelsius("cook to 165°F then rest").length, 1);
  assert.deepEqual(fahrenheitWithoutCelsius("warm water (about 110°F/43°C)"), []);
  assert.deepEqual(fahrenheitWithoutCelsius("the danger zone (40°F-140°F / 4°C-60°C)"), []);
  assert.equal(fahrenheitWithoutCelsius("150°F is still below 165°F (74°C)").length, 1);
  assert.ok(inPantry("boneless chicken thighs", ["Chicken Thighs"]));
  assert.ok(inPantry("garlic cloves", ["Garlic"]));
  assert.ok(!inPantry("heavy cream", ["milk", "lemon"]));

  // Server-side suggestion guard (src/lib/dietGuard.ts): drops unsafe cards, keeps safe ones.
  const prefs = (p: Partial<Preferences>) => context({ ingredients: [{ name: "x" }], preferences: p }).preferences;
  const card = (title: string, used: string[], buy: string[] = [], minutes = 30): RecipeCard => ({ ...CHICKEN_CARD, title, totalMinutes: minutes, usedIngredients: used, missingIngredients: buy.map((name) => ({ name, aisle: "Other" })) });
  assert.match(violation(card("Chicken Pad Thai", ["Rice Noodles"], ["Crushed peanuts"]), prefs({ allergies: ["Peanuts"] })) ?? "", /Peanuts/);
  assert.match(violation(card("Chicken Satay", ["Chicken"]), prefs({ allergies: ["Peanuts"] })) ?? "", /Peanuts/);
  assert.equal(violation(card("Peanut-Free Sesame Noodles", ["Rice Noodles"]), prefs({ allergies: ["Peanuts"] })), null);
  assert.match(violation(card("Stir-Fry", ["Chicken", "Soy Sauce"]), prefs({ diets: ["Gluten-free"] })) ?? "", /Gluten/);
  assert.equal(violation(card("Stir-Fry", ["Chicken", "Tamari", "Rice Noodles", "Gluten-free Tortillas"]), prefs({ diets: ["Gluten-free"] })), null);
  assert.equal(violation(card("Creamy Coconut Curry", ["Chickpeas", "Coconut Milk", "Eggplant", "Peanut Butter"]), prefs({ diets: ["Vegan"] })), null);
  assert.match(violation(card("Tofu Bowl", ["Tofu"], ["Fish Sauce"]), prefs({ diets: ["Vegan"] })) ?? "", /Vegan/);
  assert.match(violation(card("Fried Rice", ["Rice"], ["Shrimp"]), prefs({ allergies: ["Shellfish"] })) ?? "", /Shellfish/);
  assert.match(violation(card("Kiwi Salad", ["Kiwi"]), prefs({ allergies: ["kiwis"] })) ?? "", /kiwis/);
  assert.equal(violation(card("Herb Salad", ["Parsley"], ["a bunch of cilantro"]), prefs({ diets: ["Gluten-free"] })), null);
  assert.match(violation(card("Slow Stew", ["Beef"], [], 90), prefs({ maxMinutes: 45 })) ?? "", /limit/);
  assert.match(violation(card("Big Shop", ["Rice"], ["a", "b", "c", "d"]), prefs({ maxExtras: 3 })) ?? "", /extras/);
}

// ---------- Run ----------

interface RunResult {
  id: string;
  stage: Stage;
  description: string;
  attempt: number;
  status: "pass" | "fail" | "error" | "skip";
  ms: number;
  checks: CheckResult[];
  judge?: JudgeResult;
  error?: string;
  output?: unknown;
}

async function runOne(c: EvalCase, attempt: number): Promise<RunResult> {
  const base = { id: c.id, stage: c.stage, description: c.description, attempt };
  const skip = c.skip?.();
  if (skip) return { ...base, status: "skip", ms: 0, checks: [], error: skip };
  const t = Date.now();
  let output: unknown;
  try {
    output = await c.run(makeApi());
  } catch (err) {
    return { ...base, status: "error", ms: Date.now() - t, checks: [], error: (err as Error).message };
  }
  const ms = Date.now() - t;

  const checks: CheckResult[] = [];
  if (c.schema) {
    const parsed = c.schema.safeParse(output);
    checks.push({ name: "matches the response schema", pass: parsed.success, severity: "fail", detail: parsed.success ? undefined : parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    if (!parsed.success) return { ...base, status: "fail", ms, checks, output };
  }
  try {
    checks.push(...c.checks(output));
  } catch (err) {
    checks.push({ name: "checks ran without crashing", pass: false, severity: "fail", detail: (err as Error).message });
  }

  let judged: JudgeResult | undefined;
  if (useJudge && c.rubric) {
    try {
      judged = await judge(c, output);
    } catch (err) {
      checks.push({ name: "LLM judge ran", pass: false, severity: "warn", detail: (err as Error).message });
    }
  }
  const failed = checks.some((r) => r.severity === "fail" && !r.pass) || judged?.pass === false;
  return { ...base, status: failed ? "fail" : "pass", ms, checks, judge: judged, output };
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function printResult(r: RunResult) {
  const tag = { pass: green("PASS"), fail: red("FAIL"), error: red("ERR "), skip: yellow("SKIP") }[r.status];
  const failedChecks = r.checks.filter((c) => !c.pass && c.severity === "fail");
  const warns = r.checks.filter((c) => !c.pass && c.severity === "warn");
  const passed = r.checks.filter((c) => c.pass).length;
  const judgeTag = r.judge ? ` judge ${r.judge.score}/5${r.judge.pass ? "" : red(" ✗")}` : "";
  const rep = repeat > 1 ? dim(` #${r.attempt + 1}`) : "";
  console.log(`${tag} ${r.id}${rep} ${dim(`${(r.ms / 1000).toFixed(1)}s`)}  ${dim(`checks ${passed}/${r.checks.length}`)}${judgeTag}${warns.length ? yellow(` ${warns.length} warn`) : ""}`);
  if (r.error) console.log(`     ${r.status === "skip" ? yellow(r.error) : red(r.error)}`);
  for (const c of failedChecks) console.log(`     ${red("✗")} ${c.name}${c.detail ? dim(`: ${c.detail}`) : ""}`);
  for (const c of warns) console.log(`     ${yellow("!")} ${c.name}${c.detail ? dim(`: ${c.detail}`) : ""}`);
  if (r.judge && (!r.judge.pass || verbose)) console.log(`     ${r.judge.pass ? dim("judge:") : red("judge:")} ${dim(r.judge.reasoning)}`);
  if (verbose) {
    for (const c of r.checks.filter((x) => x.pass)) console.log(`     ${green("✓")} ${dim(c.name)}`);
    if (r.output !== undefined) console.log(dim(`     output: ${(typeof r.output === "string" ? r.output : JSON.stringify(r.output)).slice(0, 1500)}`));
  }
}

function summarize(results: RunResult[]) {
  console.log(`\n${bold("Summary")}`);
  const rows = STAGES.map((stage) => {
    const rs = results.filter((r) => r.stage === stage && r.status !== "skip");
    if (!rs.length) return null;
    const pass = rs.filter((r) => r.status === "pass").length;
    const scores = rs.flatMap((r) => (r.judge ? [r.judge.score] : []));
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "-";
    const sec = (rs.reduce((a, r) => a + r.ms, 0) / rs.length / 1000).toFixed(1);
    return { stage, pass: `${pass}/${rs.length}`, rate: `${Math.round((pass / rs.length) * 100)}%`, judge: avg, avgSeconds: sec };
  }).filter(Boolean);
  console.table(rows);

  if (repeat > 1) {
    const flaky = [...new Set(results.map((r) => r.id))]
      .map((id) => ({ id, rs: results.filter((r) => r.id === id) }))
      .filter(({ rs }) => new Set(rs.map((r) => r.status)).size > 1);
    if (flaky.length) console.log(yellow(`Flaky (mixed results across ${repeat} runs): ${flaky.map((f) => `${f.id} ${f.rs.filter((r) => r.status === "pass").length}/${f.rs.length}`).join(", ")}`));
  }

  const ran = results.filter((r) => r.status !== "skip");
  const pass = ran.filter((r) => r.status === "pass").length;
  const line = `${pass}/${ran.length} passed (${ran.length ? Math.round((pass / ran.length) * 100) : 0}%)`;
  console.log(pass === ran.length ? green(bold(line)) : red(bold(line)));
}

// ---------- Main ----------

if (flag("dry") || flag("list")) {
  selfTest();
  console.log(green("Fixtures valid and checker self-tests passed.\n"));
  for (const c of selected) console.log(`${c.id.padEnd(42)} ${dim(c.description)}${c.rubric ? dim(" [judge]") : ""}`);
  const judged = selected.filter((c) => c.rubric).length;
  console.log(`\n${selected.length} cases x ${repeat} = ~${selected.length * repeat} agent calls, ${useJudge ? judged * repeat : 0} judge calls (${judgeModel}).`);
  if (!scanCases.length) console.log(dim("No scan cases: add photos to server/evals/fixtures/scan/ (see README)."));
  process.exit(0);
}

if (!selected.length) {
  console.error("No cases match those filters. Try --list.");
  process.exit(2);
}

selfTest();

const health = await fetch(`${BASE}/api/health`)
  .then((r) => r.json() as Promise<{ openai: string; model: string; storage: string }>)
  .catch(() => null);
if (!health) {
  console.error(red(`Can't reach the server at ${BASE}. Start it with \`npm run dev\` (or set EVAL_BASE).`));
  process.exit(2);
}
if (health.openai !== "configured") {
  console.error(red("The server has no OPENAI_API_KEY. Add it to the root .env and restart."));
  process.exit(2);
}
if (useJudge && !process.env.OPENAI_API_KEY) {
  console.error(red("The judge needs OPENAI_API_KEY in the root .env (or pass --no-judge)."));
  process.exit(2);
}

const judgedCount = useJudge ? selected.filter((c) => c.rubric).length * repeat : 0;
console.log(bold(`Pantry Chef evals`) + dim(` | agent ${health.model} @ ${BASE} | judge ${useJudge ? judgeModel : "off"}`));
console.log(dim(`${selected.length} cases x ${repeat} run(s), ${judgedCount} judge calls, concurrency ${concurrency}\n`));

const jobs = selected.flatMap((c) => Array.from({ length: repeat }, (_, attempt) => ({ c, attempt })));
const results = await pool(jobs, concurrency, async ({ c, attempt }) => {
  const r = await runOne(c, attempt);
  printResult(r);
  return r;
});

summarize(results);

const outDir = path.join(EVALS_DIR, "results");
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, agentModel: health.model, judgeModel: useJudge ? judgeModel : null, repeat, results }, null, 2));
console.log(dim(`Full report: ${path.relative(process.cwd(), file)}`));

process.exit(results.some((r) => r.status === "fail" || r.status === "error") ? 1 : 0);
