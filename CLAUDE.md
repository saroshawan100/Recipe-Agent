# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Pantry Chef: an AI cooking assistant. Users pick the ingredients they have. The app then:
- suggests recipes in two groups, "make now" and "worth a quick shop"
- generates full recipes with nutrition and a dish photo
- builds an aisle-grouped shopping list
- runs a live, voice-driven coaching mode ("Cook with the Chef")

It's an npm-workspaces monorepo: `server/` (Express 5 + OpenAI) and `client/` (React 19 + Vite).

## Commands

Run all of these from the repo root.

| Command | Purpose |
| --- | --- |
| `npm install` | Install both workspaces |
| `npm run dev` | Server (tsx watch, :5000) and client (Vite, :5173) together. Vite proxies `/api` and `/generated` to the server. |
| `npm run typecheck` | Type-check server, then client. **Run this after every change.** |
| `npm run build` | Compile `server/dist` and bundle `client/dist` |
| `npm start` | Run the built server, which also serves `client/dist` |
| `node server/scripts/e2e.mjs` | End-to-end API test against a running dev server. Makes **real, billed OpenAI calls**. `WITH_IMAGE=1` adds image generation. |
| `npm run eval -- --dry` | Free: validates eval fixtures and self-tests the checkers |
| `npm run eval` | Agent output evals (`server/evals/`) against a running dev server. **Real, billed OpenAI calls**, including an LLM judge (`--no-judge` to skip). See `server/evals/README.md`. |

There is no unit-test suite or linter. `typecheck` is the main correctness gate. Ask before running `e2e.mjs` or `npm run eval` (without `--dry`), because they cost money.

Env vars go in the **root** `.env` (see `.env.example`). Only `OPENAI_API_KEY` is required.

## Architecture

### Storage modes (most important concept)
`server/src/config.ts` picks a mode at startup: `mongo` if `MONGODB_URI` is set, otherwise `browser`. `STORAGE=browser|mongo` overrides that.

- **Browser mode (default):** the server is stateless. Only `/api/ai/*` (`routes/ai.ts`) is mounted. The client stores everything in IndexedDB and sends the full recipe context with each AI request.
- **Mongo mode:** the data routes (`recipes`, `cook`, `chat`, `pantry`, `saved`, `shopping-list`) are also mounted behind `requireDb`. They persist to MongoDB through the models in `server/src/models/`.

The client calls `GET /api/health` once and picks a backend (`client/src/api/backend/index.ts`):
- `local.ts`: IndexedDB plus `/api/ai/*`
- `remote.ts`: the Mongo REST routes

Both implement the `Backend` interface in `client/src/api/backend/types.ts`.

**When you add or change a feature that touches data or AI, update both modes:**
- server: `routes/ai.ts` **and** the matching Mongo route
- client: `local.ts` **and** `remote.ts`, plus the `Backend` interface

### Server (`server/src`)
- `index.ts`: middleware chain helmet → cors → json → `requireClientId` → routes → `errorHandler`. Every `/api` route requires an `X-Client-Id` header matching `^[A-Za-z0-9_-]{8,64}$`. There are no user accounts; this ID scopes Mongo data and rate limits.
- `schemas/`: Zod schemas used as **both** the OpenAI response formats and the request validators.
- `services/prompts.ts`: every prompt, built on a shared `CHEF_PERSONA` and `SAFETY_TEMPS`.
- `services/openaiService.ts`: `structured()` wraps `chat.completions.parse` + `zodResponseFormat`. It returns 422 when the model refuses and 502 when the response is empty.
- `services/coachService.ts`, `services/imageService.ts`: coaching scripts, check-ins and dish photos (written to `server/public/generated/*.webp`).
- `lib/sse.ts`: `streamCompletion` sends `data: {"delta": ...}` chunks, then `data: [DONE]`, and aborts the OpenAI request if the client disconnects.
- `lib/dedupe.ts`: concurrent requests with the same key share one in-flight promise.
- `middleware/rateLimit.ts`: `aiLimiter` allows 30 requests/min per client. Apply it to every AI endpoint.

### Client (`client/src`)
- `router.tsx` routes:
  - `/` Kitchen, `/recipe/:id`, `/saved` and `/shopping` render inside `AppShell`
  - `/cook/:id` is full-screen
  - every page except Kitchen is lazy-loaded
- `api/hooks.ts`: TanStack Query wrappers around `getBackend()`. `api/client.ts` has `api()` (JSON) and `streamApi()` (a manual SSE reader).
- `store/`: Zustand stores.
  - `useKitchenStore`: selection, staples, prefs, results. Persisted to localStorage.
  - `useChatStore`: chat drawer history.
  - `useUiStore`: voice and chime settings.
- `hooks/useCoachPlayer.ts`: plays a coaching script against the step clock. `shiftUpcoming` delays unplayed cues and `insert` splices in new ones.
- Other hooks: `useChefVoice` (Web Speech API), `useWakeLock`, `useStreamingChat`.
- `data/ingredients.ts`: ingredient catalog (TheMealDB images, emoji fallback).
- Import alias: `@/` → `client/src/`.
- Styling: Tailwind v4 + Radix UI primitives in `components/ui/`.

## AI workflow

The app runs a pipeline of single-purpose LLM calls rather than an autonomous agent loop. All calls use `OPENAI_MODEL` (default `gpt-4.1-mini`).

| Stage | Prompt | Schema | Output | Notes |
| --- | --- | --- | --- | --- |
| Scan (photo) | `scanPrompt` | `ScanResult` | structured (vision) | `/api/ai/scan` in both modes, 5 MB body limit; client downsizes first (`lib/resizeImage.ts`) |
| Suggest | `suggestPrompt` | `SuggestResult` | structured | Server re-sorts each card by whether `missingIngredients` is empty |
| Details | `detailsPrompt` | `RecipeDetails` | structured | Generated on first open, then cached |
| Image | `imageService` | — | webp file | Generated lazily, cached in `imageUrl` |
| Coach (per step) | `coachPrompt` | `CoachingScriptAI` | structured | Cached per step index; the client prefetches the next step |
| Check-in | `checkinPrompt` | `CheckinAI` | structured | Returns `message`, `heatChange`, `addSeconds`, ≤3 `newCues` (times relative to now) |
| Ask (in-cook) | `askSystemPrompt` | — | SSE stream | Includes the recipe, current step and elapsed seconds |
| Chat (drawer) | `chatSystemPrompt` | — | SSE stream | Includes the pantry and the current recipe |

## Conventions and gotchas

- **OpenAI Structured Outputs:** AI output schemas cannot have optional fields. Use `.nullable()` instead, and put guidance for the model in `.describe()`.
- **Clean model output on the server, never trust it:**
  - follow the existing pattern (`normalizeCard`, `withIds`, clamping `atSecond`/`addSeconds`)
  - suggestions pass through `lib/dietGuard.ts`, which drops cards that break allergies, diets, max time or max extras. Extend it when you add a preference.
  - keep cues sorted, with the first cue at 0
- **Safety rules in prompts:**
  - allergies and diets are restated in each prompt
  - the safe temperatures in `SAFETY_TEMPS` are part of the prompts
  - check-ins lead with the safety action (e.g. never water on a grease fire)

  Keep these intact when you edit prompts.
- **Caching:** cache expensive AI results (details, coaching scripts, images) and wrap their generation in `dedupe()`.
- **Imports:** the server is ESM. Relative imports need a `.js` extension (`./config.js`).
- **Errors:** throw `HttpError(status, message)`. Express 5 forwards async errors to `errorHandler`, so you don't need try/catch in routes.
- **API key:** the OpenAI key must stay server-side. The client never calls OpenAI directly.
- **CSP:** helmet's CSP is deliberately disabled, because the SPA loads Google Fonts, TheMealDB images and an inline theme script.
- **Units:** recipes use US customary units, with °F followed by °C in parentheses.
