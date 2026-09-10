# KoulZeb

Plan a group dinner out, together. Share one link, then everyone adds the times
they're free and the cuisines they like, plus restaurants. KoulZeb crosses
availability × cuisine preferences × the restaurant list and ranks where and when
to eat. The host confirms the final pick.

Runs entirely on Netlify: static frontend + one serverless function + Netlify
Blobs for storage. No external database, no accounts.

## Stack

- **Frontend:** vanilla TypeScript SPA, hash routing, built with Vite.
- **API:** one Netlify Function (`netlify/functions/api.ts`) served under `/api/*`.
- **Storage:** Netlify Blobs (JSON docs), strong consistency.
- **Restaurant search:** Google Places API (New), called server-side only.
- **Identity:** invite link only. Each participant gets a UUID token kept in
  `localStorage`; no sign-up.

## Local development

```bash
npm install
npm run dev        # netlify dev on http://localhost:8888 (local Blobs emulation)
```

`netlify dev` is required locally because it provides the Blobs backend and
proxies the Vite dev server (port 5173) and the API. For Places search, copy
`.env.example` to `.env` and fill in `GOOGLE_PLACES_API_KEY` (see below).

## Checks

```bash
npm run typecheck  # tsc --noEmit
npm test           # decision-logic unit tests (node:test)
npm run build      # production build to dist/
npm run smoke      # full API flow against a running server (BASE=http://localhost:8888)
```

## Deploy

```bash
npm run build
npx netlify deploy --prod
```

Blobs is zero-config once the site exists. The only optional env var is
`GOOGLE_PLACES_API_KEY` (plus `PLACES_MONTHLY_LIMIT` / `PLACES_INCLUDE_RATING`);
set it under **Site configuration > Environment variables**. Build command
`npm run build`, publish directory `dist` (already in `netlify.toml`).

## Google Places search setup

Restaurant ideas use **Places API (New) — Text Search**, called from the
Netlify Function (the key never reaches the browser). When a participant saves
their cuisines, the app queries "`<cuisine>` restaurant in `<session city>`" for
each cuisine and offers the results to add. To turn it on:

1. **Project + billing.** At <https://console.cloud.google.com>, create/select a
   project and enable billing. Maps Platform requires a billing account even to
   use the free tier.
2. **Enable the API.** APIs & Services > Library > search **"Places API (New)"**
   > Enable.
3. **Create an API key.** APIs & Services > Credentials > Create credentials >
   API key. Then **restrict it**: under *API restrictions* allow only
   **Places API (New)**. Leave *Application restrictions* as **None** (Netlify
   Functions call from rotating IPs, so IP restriction would break it).
4. **Add it to Netlify.** Site configuration > Environment variables >
   `GOOGLE_PLACES_API_KEY = <your key>`, then redeploy. For local dev, put it in
   `.env` (git-ignored) — `netlify dev` reads it.
5. **Optional:** set a Cloud Billing **budget alert** as a safety net.

### Staying within the free tier

Google bills Places Text Search per SKU, and **the free cap depends on the
fields you request**:

| Fields requested | SKU | Free / month |
| --- | --- | --- |
| id + name + address + map link + type | Text Search **Pro** | **5,000** |
| the above **plus rating / price level** | Text Search **Enterprise** | **1,000** |
| ids only (no names) | Text Search Essentials (IDs only) | unlimited (not useful here) |

So "10k free" only applies to ids-only. Name/address/map-link needs Pro (5k);
rating/price needs Enterprise (1k). The app:

- **caches** each (cuisine, city) query for 7 days in Blobs, so it's one Google
  call per cuisine per city no matter how many people share it;
- enforces a **hard monthly cap** (`PLACES_MONTHLY_LIMIT`, default `5000`) and
  refuses further calls once reached, returning a friendly message.

Keep `PLACES_MONTHLY_LIMIT` at/under the SKU's free cap to avoid charges. If you
set `PLACES_INCLUDE_RATING=true`, lower it to `1000`. Cloud quotas are usually
per-minute/day, so this app-level counter is the reliable monthly guard.

> Note: Google's terms limit caching Places content to 30 days; the 7-day cache
> here stays within that.

## How it works

1. Host creates a session (dinner name, their own name, and the city) and
   shares the link.
2. Guests join with just a name.
3. Everyone freely adds the times they're free — time-of-day only (no dates), in
   30-minute slots — and the cuisines they like. On save, KoulZeb quietly asks
   Google Places for the **top 10 places per chosen cuisine** in that city, and
   the participant ticks which ones to add to the dinner's suggestion list. Each
   restaurant shows a Google Maps link.
   A friendly progress bar shows who still needs to answer, so you can nudge them.
   The session page groups things into tabs (My picks / Places / Picks) with the
   header pinned on top, so there's little scrolling.
4. The API ranks every (time, restaurant) pair: more free people first, then more
   cuisine matches, then time and name. Only people free at a time count toward
   that time's cuisine match.
5. The host confirms an option; the session is marked decided.

## Layout

```
index.html              entry page
src/                    frontend (app.ts, api.ts, state.ts, style.css)
shared/                 types, decision logic, cuisine list, maps, time slots
netlify/functions/api.ts   HTTP routing + validation
netlify/functions/lib/store.ts   Netlify Blobs access
netlify/functions/lib/places.ts  Google Places proxy (cache + monthly cap)
test/                   unit tests (decision, maps)
scripts/smoke.mjs       end-to-end API smoke test
```

## Data model (Netlify Blobs store `koulzeb`)

```
s:<sessionId>                 session meta (name, city, host, status, decision)
p:<sessionId>:<participantId> participant (free times, cuisines, suggestions)
r:<sessionId>:<restaurantId>  restaurant (name, cuisines, address, halal/vege)
```

Participants and restaurants are stored one-doc-per-item so concurrent submissions
never overwrite each other. Participant tokens are redacted from all responses.
Places search results are cached under `places-cache:*` and monthly usage is
counted under `places-usage:<YYYY-MM>`.

## Deliberate simplifications

- Polling every 5s instead of realtime push (Blobs is pull-based).
- Link-based access: anyone with the link can join; only the host can confirm.
- Times are time-of-day only (no dates), constrained to 30-minute slots.
- Map links are generated from name/address unless an explicit http(s) link is
  set; explicit links are validated to http(s) and re-guarded at render.
- Places candidates are cached per (cuisine, city) and capped app-side (see
  above); rating/price are opt-in because they drop the free tier from 5,000 to
  1,000 calls/month.
