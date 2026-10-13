const BASE = process.env.BASE ?? "http://localhost:5173";
const headers = { "Content-Type": "application/json", "X-Client-Id": "e2e-test-client-0001" };

async function call(method, path, body) {
  const t = Date.now();
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const ms = Date.now() - t;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  console.log(`OK ${method} ${path} ${res.status} ${ms}ms`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function sse(path, body) {
  const t = Date.now();
  const res = await fetch(`${BASE}/api${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`SSE ${path} -> ${res.status}: ${await res.text()}`);
  const raw = await res.text();
  const text = raw
    .split("\n\n")
    .filter((e) => e.startsWith("data: ") && e !== "data: [DONE]")
    .map((e) => JSON.parse(e.slice(6)))
    .map((d) => d.delta ?? `[ERROR ${d.error}]`)
    .join("");
  if (text.includes("[ERROR")) throw new Error(`SSE ${path} streamed an error: ${text}`);
  console.log(`OK SSE ${path} ${Date.now() - t}ms: ${text.slice(0, 160).replace(/\n/g, " ")}...`);
}

const SUGGEST_INPUT = {
  ingredients: [{ name: "Chicken Thighs" }, { name: "Garlic", useSoon: true }, { name: "Lemon" }, { name: "Potatoes" }, { name: "Rosemary" }],
  staples: ["salt", "black pepper", "olive oil", "water"],
  preferences: { servings: 2, mode: "quickShop", maxExtras: 3 },
};

const logCards = (cards, group) => {
  for (const r of cards) console.log(`  [${group}] ${r.emoji} ${r.title} (${r.matchPercent}%, need ${r.missingIngredients.length})`);
};

const firstCookStep = (details) => Math.max(0, details.steps.findIndex((s) => s.phase === "cook"));

/** Browser-storage mode: only the stateless /ai endpoints exist; the client stores everything. */
async function browserFlow() {
  const suggest = await call("POST", "/ai/suggest", SUGGEST_INPUT);
  console.log(`  chefNote: ${suggest.chefNote}`);
  logCards(suggest.makeNow, "makeNow");
  logCards(suggest.quickShop, "quickShop");

  const card = suggest.quickShop[0] ?? suggest.makeNow[0];
  const details = await call("POST", "/ai/details", { card, context: SUGGEST_INPUT });
  console.log(`  ${details.steps.length} steps, ${details.ingredients.filter((i) => !i.have).length} to buy`);

  const cookIdx = firstCookStep(details);
  const script = await call("POST", "/ai/coach", { title: card.title, details, stepIndex: cookIdx });
  console.log(`  step ${cookIdx + 1} "${script.title}" ${script.mode} ~${script.estimatedSeconds}s, ${script.cues.length} cues`);
  const check = script.cues.find((c) => c.type === "check");
  const fix = await call("POST", "/ai/checkin", {
    title: card.title,
    details,
    stepIndex: cookIdx,
    answer: "problem",
    issue: "It's sticking to the pan",
    elapsedSeconds: 120,
    cueText: check?.say,
  });
  console.log(`  checkin: ${fix.message} (heat ${fix.heatChange}, +${fix.addSeconds}s, ${fix.newCues.length} new cues)`);

  await sse("/ai/ask", {
    title: card.title,
    details,
    stepIndex: cookIdx,
    elapsedSeconds: 90,
    messages: [{ role: "user", content: "How do I know when to flip it?" }],
  });
  await sse("/ai/chat", {
    messages: [{ role: "user", content: "What can I substitute for buttermilk?" }],
    pantry: ["milk", "lemon"],
    recipe: { title: card.title, details },
  });

  const bad = await fetch(`${BASE}/api/ai/coach`, { method: "POST", headers, body: JSON.stringify({ title: card.title, details, stepIndex: 99 }) });
  if (bad.status !== 400) throw new Error(`out-of-range step should be 400, got ${bad.status}`);
  const mongoRoute = await fetch(`${BASE}/api/saved`, { headers });
  if (mongoRoute.status !== 404) throw new Error(`MongoDB routes should be disabled in browser mode, got ${mongoRoute.status}`);
  console.log("OK validation and disabled MongoDB routes");

  if (process.env.WITH_IMAGE) {
    const img = await call("POST", "/ai/image", { card, key: "e2e-test-image" });
    console.log(`  image: ${img.imageUrl}`);
  }
}

/** MongoDB mode: the server stores recipes, pantry, lists and sessions. */
async function mongoFlow() {
  await call("PUT", "/pantry", { items: [{ name: "Chicken Thighs" }, { name: "Garlic", useSoon: true }], staples: ["salt", "olive oil"] });

  const suggest = await call("POST", "/recipes/suggest", SUGGEST_INPUT);
  console.log(`  chefNote: ${suggest.chefNote}`);
  logCards(suggest.makeNow, "makeNow");
  logCards(suggest.quickShop, "quickShop");

  const pick = suggest.quickShop[0] ?? suggest.makeNow[0];
  const detail = await call("POST", `/recipes/${pick.id}/details`);
  console.log(`  ${detail.details.steps.length} steps, ${detail.details.ingredients.filter((i) => !i.have).length} to buy`);
  const again = await call("POST", `/recipes/${pick.id}/details`);
  console.log(`  cached details same: ${JSON.stringify(again.details) === JSON.stringify(detail.details)}`);

  await call("DELETE", "/shopping-list");
  const list = await call("POST", "/shopping-list/from-recipe", { recipeId: pick.id, scale: 1 });
  console.log(`  shopping list: ${list.items.map((i) => `${i.name} [${i.aisle}]`).join(", ")}`);
  if (list.items.some((i) => !i.recipes.some((r) => r.id === pick.id))) throw new Error("shopping items missing recipe reference");
  if (list.items[0]) await call("PATCH", `/shopping-list/items/${list.items[0].id}`, { checked: true });
  await call("POST", "/shopping-list/items", { name: "Paper towels", aisle: "Other" });

  await call("POST", `/saved/${pick.id}`);
  const saved = await call("GET", "/saved");
  console.log(`  saved count: ${saved.length}`);

  const session = await call("POST", "/cook/sessions", { recipeId: pick.id });
  const cookIdx = firstCookStep(detail.details);
  const script = await call("POST", `/cook/${pick.id}/steps/${cookIdx}/coach`);
  console.log(`  step ${cookIdx + 1} "${script.title}" ${script.mode} ~${script.estimatedSeconds}s, ${script.cues.length} cues`);
  for (const c of script.cues) console.log(`    [${c.atSecond}s] ${c.type}: ${c.say}`);
  const check = script.cues.find((c) => c.type === "check");
  const fix = await call("POST", "/cook/checkin", {
    recipeId: pick.id,
    stepIndex: cookIdx,
    sessionId: session.id,
    cueId: check?.id,
    answer: "problem",
    issue: "It's sticking to the pan",
    elapsedSeconds: 120,
  });
  console.log(`  checkin: ${fix.message} (heat ${fix.heatChange}, +${fix.addSeconds}s, ${fix.newCues.length} new cues)`);
  await call("PATCH", `/cook/sessions/${session.id}`, { currentStep: cookIdx, stepElapsedSeconds: 42 });

  await sse("/cook/ask", { recipeId: pick.id, stepIndex: cookIdx, elapsedSeconds: 90, messages: [{ role: "user", content: "How do I know when to flip it?" }] });
  await sse("/chat", { messages: [{ role: "user", content: "What can I substitute for buttermilk?" }], context: { pantry: ["milk", "lemon"], recipeId: pick.id } });

  if (process.env.WITH_IMAGE) {
    const img = await call("POST", `/recipes/${pick.id}/image`);
    console.log(`  image: ${img.imageUrl}`);
  }
}

const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
console.log("health", health);
await (health.storage === "mongo" ? mongoFlow() : browserFlow());
console.log("E2E PASSED");
