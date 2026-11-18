# KoulZeb

Plan a group dinner out, together. Share one link, then everyone adds the times they're free and the cuisines they like, plus restaurants. KoulZeb crosses availability × cuisine preferences × the restaurant list and ranks where and when to eat. The host confirms the final pick.

Runs entirely on Netlify: static frontend + one serverless function + Netlify Blobs for storage. No external database, no accounts.

## Stack

- **Frontend:** vanilla TypeScript SPA, hash routing, built with Vite.
- **API:** one Netlify Function (`netlify/functions/api.ts`) served under `/api/*`.
- **Storage:** Netlify Blobs (JSON docs), strong consistency.
- **Restaurant search:** Google Places API (New), called server-side only.
- **Identity:** invite link only. Each participant gets a UUID token kept in `localStorage`; no sign-up.

## Getting started

```bash
npm install
npm run dev        # netlify dev on http://localhost:8888 (local Blobs emulation)
```

`netlify dev` is required locally because it provides the Blobs backend and proxies the Vite dev server (port 5173) and the API. For Places search, copy `.env.example` to `.env` and fill in `GOOGLE_PLACES_API_KEY`.

Checks:

```bash
npm run typecheck  # tsc --noEmit
npm test           # decision-logic unit tests (node:test)
npm run build      # production build to dist/
npm run smoke      # full API flow against a running server (BASE=http://localhost:8888)
```

Deploy:

```bash
npm run build
npx netlify deploy --prod
```

Build command `npm run build`, publish directory `dist` and the functions directory are set in `netlify.toml`.

## Google Places search

Restaurant ideas use **Places API (New) — Text Search**, called from the Netlify Function, so the key never reaches the browser. When a participant saves their cuisines, the app queries "`<cuisine>` restaurant in `<session city>`" and offers the top 10 results to add.

Setup:

1. Create a Google Cloud project with billing enabled.
2. Enable **Places API (New)**.
3. Create an API key and restrict it to that API. Leave application restrictions as **None** (Netlify Functions call from rotating IPs).
4. Set `GOOGLE_PLACES_API_KEY` in Netlify environment variables and redeploy, or in `.env` for local development.

Place billing depends on the requested fields: name/address/map link is the **Pro** SKU (5,000 free calls/month); adding rating or price moves to **Enterprise** (1,000 free calls/month). The app caches each (cuisine, city) query for 7 days and enforces `PLACES_MONTHLY_LIMIT` (default `5000`) as a hard monthly cap. Set `PLACES_INCLUDE_RATING=true` only if you also lower that limit to 1000.

## How it works

1. The host creates a session (dinner name, their own name, city) and shares the link.
2. Guests join with just a name.
3. Everyone adds the times they're free (30-minute slots, time of day only) and their cuisines. On save, the app fetches restaurant suggestions for those cuisines in the session city, and each participant ticks the ones to add.
4. The API ranks every (time, restaurant) pair: more free people first, then more cuisine matches, then time and name. Only people free at a time count toward that time's cuisine match.
5. The host confirms an option and the session is marked decided.

## Data model (Netlify Blobs store `koulzeb`)

```
s:<sessionId>                 session meta (name, city, host, status, decision)
p:<sessionId>:<participantId> participant (free times, cuisines, suggestions)
r:<sessionId>:<restaurantId>  restaurant (name, cuisines, address, halal/vege)
```

One document per participant and per restaurant, so concurrent submissions never overwrite each other. Participant tokens are redacted from responses. Places results are cached under `places-cache:*`; monthly usage is counted under `places-usage:<YYYY-MM>`.

## Layout

```
index.html                       entry page
src/                             frontend (app.ts, api.ts, state.ts, style.css)
shared/                          types, decision logic, cuisines, maps, time slots
netlify/functions/api.ts         HTTP routing + validation
netlify/functions/lib/store.ts   Netlify Blobs access
netlify/functions/lib/places.ts  Google Places proxy (cache + monthly cap)
test/                            unit tests
scripts/smoke.mjs                end-to-end API smoke test
```

## Notes

- Polling every 5 s instead of realtime push (Blobs is pull-based).
- Link-based access: anyone with the link can join; only the host can confirm.
- Map links are generated from name/address unless an explicit http(s) link is set; explicit links are validated and re-checked at render.
- Places results are cached per (cuisine, city) and capped app-side; Google's terms allow caching for up to 30 days, and the 7-day TTL stays within that.
