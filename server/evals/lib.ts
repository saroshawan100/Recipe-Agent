import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";
import type { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
export const EVALS_DIR = here;
dotenv.config({ path: path.resolve(here, "../../.env") });

export const BASE = process.env.EVAL_BASE ?? `http://localhost:${process.env.PORT ?? 5000}`;

// ---------- Case definitions ----------

export type Stage = "suggest" | "details" | "coach" | "checkin" | "ask" | "chat" | "scan";
export const STAGES: Stage[] = ["suggest", "details", "coach", "checkin", "ask", "chat", "scan"];

export interface CheckResult {
  name: string;
  pass: boolean;
  /** "fail" checks decide the case; "warn" checks are heuristics that are reported but never fail it. */
  severity: "fail" | "warn";
  detail?: string;
}

export interface EvalCase<T = unknown> {
  id: string;
  stage: Stage;
  description: string;
  /** Returns a reason to skip (e.g. a missing fixture), or null to run. */
  skip?: () => string | null;
  run: (api: Api) => Promise<T>;
  /** When set, the response must parse against this schema before any other check runs. */
  schema?: z.ZodTypeAny;
  checks: (output: T) => CheckResult[];
  /** Grading rubric for the LLM judge. Cases without one are graded only by checks. */
  rubric?: string;
  /** What the agent was given, shown to the judge alongside the output. */
  judgeInput?: string;
}

export const defineCase = <T>(c: EvalCase<T>): EvalCase<unknown> => c as EvalCase<unknown>;

export const check = (name: string, pass: boolean, detail?: string): CheckResult => ({ name, pass, severity: "fail", detail: pass ? undefined : detail });
export const warn = (name: string, pass: boolean, detail?: string): CheckResult => ({ name, pass, severity: "warn", detail: pass ? undefined : detail });

// ---------- API client ----------

export interface Api {
  post<T>(path: string, body: unknown): Promise<T>;
  /** POSTs to an SSE endpoint and returns the full streamed text. */
  stream(path: string, body: unknown): Promise<string>;
  /** Raw status for negative tests; never throws on HTTP errors. */
  status(path: string, body: unknown): Promise<number>;
}

export function makeApi(): Api {
  // A fresh client ID per case keeps each case under its own 30 req/min rate-limit bucket.
  const headers = { "Content-Type": "application/json", "X-Client-Id": `eval-${randomUUID().slice(0, 12)}` };
  const send = (p: string, body: unknown) => fetch(`${BASE}/api${p}`, { method: "POST", headers, body: JSON.stringify(body) });
  return {
    async post<T>(p: string, body: unknown) {
      const res = await send(p, body);
      const text = await res.text();
      if (!res.ok) throw new Error(`POST ${p} -> ${res.status}: ${text.slice(0, 300)}`);
      return JSON.parse(text) as T;
    },
    async stream(p: string, body: unknown) {
      const res = await send(p, body);
      if (!res.ok) throw new Error(`SSE ${p} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
      let out = "";
      for (const event of (await res.text()).split("\n\n")) {
        if (!event.startsWith("data: ") || event === "data: [DONE]") continue;
        const data = JSON.parse(event.slice(6)) as { delta?: string; error?: string };
        if (data.error) throw new Error(`SSE ${p} streamed an error: ${data.error}`);
        out += data.delta ?? "";
      }
      return out;
    },
    async status(p: string, body: unknown) {
      const res = await send(p, body);
      await res.arrayBuffer();
      return res.status;
    },
  };
}

// ---------- Text helpers ----------

/** Every string value in an object, joined, lowercased. */
export function allText(value: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out.join("\n").toLowerCase();
}

const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(oes|es)$/, "o").replace(/s$/, "");
const STOP = new Set(["fresh", "large", "small", "medium", "boneless", "skinless", "bone", "skin", "chopped", "ground", "whole", "dried", "extra", "virgin", "kosher", "sea", "and", "or", "of", "the", "for"]);
export const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem);

/** Loose match: the ingredient shares a meaningful word with something the cook has. Heuristic, so use with warn(). */
export function inPantry(ingredient: string, have: string[]): boolean {
  const t = new Set(tokens(ingredient));
  return have.some((h) => tokens(h).some((w) => t.has(w)));
}

export interface Lexicon {
  /** Regexes for terms that indicate the restricted food. */
  terms: RegExp[];
  /** Phrases removed before scanning, e.g. "peanut-free", "coconut milk". */
  allow?: RegExp[];
}

/** Returns the forbidden terms found in `text`, after stripping allowed phrases. */
export function findForbidden(text: string, lex: Lexicon): string[] {
  let t = text.toLowerCase();
  for (const a of lex.allow ?? []) t = t.replace(new RegExp(a.source, a.flags.includes("g") ? a.flags : a.flags + "g"), " ");
  const hits = new Set<string>();
  for (const re of lex.terms) {
    const m = t.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
    m?.forEach((x) => hits.add(x.trim()));
  }
  return [...hits];
}

/** Allows "peanut-free", "no peanuts", "allergic to peanuts" style mentions. */
const negations = (word: string) => [new RegExp(`${word}\\w*[- ]free`), new RegExp(`(?:no|without|avoid|omit|skip|allergic to|allergy|instead of)\\s+(?:\\w+\\s+){0,2}${word}\\w*`)];

export const LEX = {
  peanut: { terms: [/\bpeanuts?\b/, /\bgroundnuts?\b/, /\bsatay\b/], allow: negations("peanut") },
  shellfish: {
    terms: [/\bshrimps?\b/, /\bprawns?\b/, /\bcrabs?\b/, /\blobsters?\b/, /\bscallops?\b/, /\bclams?\b/, /\bmussels?\b/, /\boysters?\b/, /\bcrawfish\b/, /\bcrayfish\b/, /\bshellfish\b/, /\boyster sauce\b/],
    allow: [...negations("shellfish"), ...negations("shrimp"), /\bimitation crab\b/],
  },
  treeNut: {
    terms: [/\balmonds?\b/, /\bcashews?\b/, /\bwalnuts?\b/, /\bpecans?\b/, /\bhazelnuts?\b/, /\bpistachios?\b/, /\bmacadamias?\b/, /\bpine nuts?\b/, /\bbrazil nuts?\b/],
    allow: [...negations("nut"), ...negations("almond")],
  },
  sesame: { terms: [/\bsesame\b/, /\btahini\b/], allow: negations("sesame") },
  /** Animal products a vegan dish can't contain. Plant milks/butters are allowed. */
  animal: {
    terms: [
      /\bchicken\b/, /\bbeef\b/, /\bpork\b/, /\bbacon\b/, /\bham\b/, /\blamb\b/, /\bturkey\b/, /\bsausages?\b/, /\bfish\b/, /\bsalmon\b/, /\btuna\b/, /\banchov\w*/, /\bshrimps?\b/,
      /\beggs?\b/, /\bmilk\b/, /\bbutter\b/, /\bcheeses?\b/, /\bparmesan\b/, /\bmozzarella\b/, /\bfeta\b/, /\bcheddar\b/, /\bcream\b/, /\byogh?urt\b/, /\bghee\b/, /\bhoney\b/, /\bgelatin\b/, /\bfish sauce\b/, /\bmayo(?:nnaise)?\b/,
    ],
    allow: [
      /\b(?:coconut|almond|oat|soy|cashew|plant[- ]based|vegan|non[- ]dairy|dairy[- ]free)\s+(?:milk|butter|cream|yogh?urt|cheeses?|mayo(?:nnaise)?)\b/,
      /\b(?:peanut|nut|almond|cashew|seed|sunflower|apple|cocoa|shea) butter\b/,
      /\bcoconut cream\b/, /\bcream of tartar\b/, /\bvegan \w+/, /\bflax eggs?\b/, /\begg[- ]free\b/, /\bdairy[- ]free\b/, /\bmeat[- ]free\b/, /\bchickpeas?\b/, /\beggplants?\b/,
      /\bbutternut\b/, /\bbutter beans?\b/, /\bbutter lettuce\b/, /\bno (?:meat|dairy|eggs?)\b/, /\bwithout (?:meat|dairy|eggs?)\b/,
    ],
  },
  /** Gluten sources. Gluten-free versions are allowed. */
  gluten: {
    terms: [/\bwheat\b/, /\bflour\b/, /\bpasta\b/, /\bspaghetti\b/, /\bpenne\b/, /\bnoodles?\b/, /\bbread\w*\b/, /\bcouscous\b/, /\bbarley\b/, /\brye\b/, /\bsoy sauce\b/, /\btortillas?\b/, /\bpanko\b/, /\bbulgur\b/, /\bseitan\b/],
    allow: [
      /\bgluten[- ]free\s+(?:\w+\s+){0,2}\w+/, /\b(?:rice|almond|coconut|chickpea|corn|tapioca|oat|potato|cassava|buckwheat)\s+(?:flour|noodles?|pasta|tortillas?|bread\w*)\b/, /\bcorn tortillas?\b/,
      /\btamari\b/, /\bcornstarch\b/, /\bbuckwheat\b/, /\b(?:glass|soba|vermicelli) noodles?\b/, /\bbreadcrumb-free\b/, /\bno (?:bread|pasta|flour)\b/,
    ],
  },
} satisfies Record<string, Lexicon>;

/**
 * Every °F reading must come with its °C conversion right after it (CLAUDE.md units rule).
 * Accepts "165°F (74°C)", "110°F/43°C" and ranges like "40°F-140°F (4°C-60°C)".
 */
export function fahrenheitWithoutCelsius(text: string): string[] {
  const bad: string[] = [];
  const conversion = /^(?:\s*(?:-|–|to)\s*\d{2,3}\s*°\s*f)?\s*[(/,]?\s*-?\d{1,3}\s*°\s*c/i;
  for (const m of text.matchAll(/\d{2,3}\s*°\s*f\b/gi)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
    if (!conversion.test(after)) bad.push(`${m[0]}${after.slice(0, 14)}`.trim());
  }
  return bad;
}

export const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter((s) => /[a-z]/i.test(s)).length;

// ---------- LLM judge ----------

export interface JudgeResult {
  pass: boolean;
  score: number;
  reasoning: string;
}

const JUDGE_MODEL = process.env.JUDGE_MODEL || "gpt-4.1";
let judgeClient: OpenAI | null = null;

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reasoning", "score", "pass"],
  properties: {
    reasoning: { type: "string", description: "2-4 sentences citing specific parts of the output" },
    score: { type: "integer", description: "1 (unacceptable) to 5 (excellent)" },
    pass: { type: "boolean", description: "true only if every MUST in the rubric is met" },
  },
} as const;

export async function judge(c: EvalCase, output: unknown): Promise<JudgeResult> {
  judgeClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 2, timeout: 120_000 });
  const completion = await judgeClient.chat.completions.create({
    model: JUDGE_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are a strict evaluator of an AI cooking assistant called Pantry Chef. Grade the output against the rubric. Food safety and allergy violations are automatic failures. Be specific and do not reward length.",
      },
      {
        role: "user",
        content: `Stage: ${c.stage}\nTest: ${c.description}\n\n## What the assistant was given\n${c.judgeInput ?? "(see test description)"}\n\n## Rubric\n${c.rubric}\n\n## Assistant output\n${typeof output === "string" ? output : JSON.stringify(output, null, 2)}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: { name: "grade", strict: true, schema: JUDGE_SCHEMA } },
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as JudgeResult;
  return { pass: Boolean(parsed.pass), score: Number(parsed.score) || 0, reasoning: String(parsed.reasoning ?? "") };
}

export const judgeModel = JUDGE_MODEL;
