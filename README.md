# Pantry Chef

An intelligent cooking assistant. Tell it what's in your kitchen (tap ingredient photos or just type), and it suggests:

- **Make it now**: recipes you can cook with what you already have
- **Worth a quick shop**: recipes that only need a few extra things

Each recipe comes with beginner-friendly steps, a glossary for cooking terms, macros and nutrition, substitutions, food-safety notes, an AI-generated photo, and a have-vs-need ingredient list that feeds a shopping list grouped by store aisle.

**Cook with the Chef** is a live, hands-free coaching mode. It walks you through each step minute by minute ("flip the chicken now", "in 2:00 we'll check for golden edges"), asks you to confirm doneness cues, adjusts the timeline when something isn't ready, and fixes problems on the spot ("the pan is smoking"). Ask the Chef can generate an on-demand visual reference for the current step, and you can attach a food photo to a question or problem report for visual advice. Input photos are resized in the browser, sent to the AI for that answer, and not saved by the app. It speaks out loud, plays chimes, and keeps your screen awake.

## Stack

- **Client:** React 19, Vite, TypeScript, Tailwind CSS v4, Radix UI, Framer Motion, TanStack Query, Zustand
- **Server:** Node, Express 5, TypeScript, OpenAI SDK (Structured Outputs + streaming)
- **Storage:** your browser (IndexedDB) by default, or MongoDB (optional)

## Quick start

You only need Node 20.14+ and your own OpenAI API key. No database required.

1. Create a `.env` file in the project root with your key:

   ```bash
   OPENAI_API_KEY=sk-...
   ```

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:5173. The API runs on http://localhost:5000, and Vite proxies `/api` and `/generated` to it.

## Storage modes

The server picks a mode at startup and logs it (`[server] storage: ...`). The app asks the server which mode is active and adapts automatically.

| Mode | When | Where data lives |
| --- | --- | --- |
| **Browser** (default) | `MONGODB_URI` is not set | Each user's browser (IndexedDB). Nothing to install. |
| **MongoDB** | `MONGODB_URI` is set | A MongoDB database, such as the Atlas free tier |

Set `STORAGE=browser` or `STORAGE=mongo` to force a mode.

**Browser mode notes**
- Recipes, saved recipes, pantry, shopping list, and cooking progress are stored per browser. They don't sync between browsers or teammates, and clearing site data erases them.
- The last 80 unsaved recipes are kept. Saved recipes are never pruned.
- Generated dish photos are saved as files in `server/public/generated/` on whichever machine runs the server.

**MongoDB mode setup**
- Add `MONGODB_URI=mongodb+srv://...` to `.env`. In Atlas, open **Network Access** and allow your current IP address, or the server won't be able to connect.
- Want a local database instead? Run `docker run -d --name pantry-chef-mongo -p 27017:27017 mongo:7` and set `MONGODB_URI=mongodb://127.0.0.1:27017/pantry-chef`. Remove it later with `docker rm -f pantry-chef-mongo`.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Your OpenAI key. Only the server ever sees it. |
| `MONGODB_URI` | no | Turns on MongoDB storage. |
| `STORAGE` | no | `browser` or `mongo` to override the automatic choice. |
| `PORT` | no | API port, default `5000`. |
| `OPENAI_MODEL` | no | Text model, default `gpt-4.1-mini`. |
| `OPENAI_IMAGE_MODEL` | no | Image model, default `gpt-image-1-mini`. |
| `OPENAI_IMAGE_QUALITY` | no | `low`, `medium` (default), or `high`. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server (tsx watch) and client (Vite) together |
| `npm run typecheck` | Type-check both packages |
| `npm run build` | Compile the server to `server/dist`, bundle the client to `client/dist` |
| `npm start` | Run the built server; it also serves `client/dist` |
| `node server/scripts/e2e.mjs` | End-to-end API test against a running dev server, for whichever storage mode is active. Makes real OpenAI calls. Set `WITH_IMAGE=1` to also test image generation. |

## How it fits together

- There are no accounts. Each browser gets an anonymous ID (stored in `localStorage`) that's sent as an `X-Client-Id` header and used for rate limiting and, in MongoDB mode, for keeping each person's data separate.
- The client talks to storage through one interface (`client/src/api/backend/`) with two implementations: `local.ts` (IndexedDB) and `remote.ts` (the MongoDB REST API).
- In browser mode the server is stateless. The client sends the recipe context with each request to `/api/ai/*` (suggest, details, image, coach, checkin, ask, chat) and stores the results itself.
- AI responses use OpenAI Structured Outputs validated with Zod, so the UI always gets well-formed recipes, nutrition, and coaching timelines.
- Expensive AI results (full recipe details, per-step coaching scripts, photos) are cached after the first request, so reopening a recipe is instant.
- Chat ("Ask the Chef") and in-cook questions stream over Server-Sent Events.
- AI endpoints are rate limited to 30 requests per minute per client.

## Project layout

```
server/src
  routes/       ai (stateless, both modes); recipes, cook, chat, pantry, saved, shopping-list (MongoDB mode)
  services/     prompts, OpenAI calls, coaching scripts, image generation
  schemas/      Zod schemas shared by prompts and request validation
  models/       Mongoose models (MongoDB mode)
client/src
  api/backend/  storage interface: local (IndexedDB) and remote (MongoDB API)
  pages/        Kitchen, RecipeDetail, CookWithChef, ShoppingList, Saved
  components/   kitchen (picker, pantry, preferences, results), recipe, cook-with-chef, chat, ui
  hooks/        step clock, coach player, chef voice, wake lock, streaming chat
  data/         ingredient catalog (photos from TheMealDB, emoji fallback)
```

Nutrition values are AI estimates. Always follow food-safety temperatures.
