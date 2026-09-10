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
- **Identity:** invite link only. Each participant gets a UUID token kept in
  `localStorage`; no sign-up.

## Local development

```bash
npm install
npm run dev        # netlify dev on http://localhost:8888 (local Blobs emulation)
```

`netlify dev` is required locally because it provides the Blobs backend and
proxies the Vite dev server (port 5173) and the API.

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

No environment variables are needed — Blobs is zero-config once the site exists.
Set the site's **build command** to `npm run build` and **publish directory** to
`dist` (already in `netlify.toml`).

## How it works

1. Host creates a session (dinner name + their own name) and shares the link.
2. Guests join with just a name.
3. Everyone freely adds the times they're free — time-of-day only (no dates), in
   30-minute slots — and the cuisines they like, and can add or edit restaurants.
   New sessions start with a default restaurant list. Every restaurant shows a
   Google Maps link (generated from its name/address, or an explicit link if set).
4. The API ranks every (time, restaurant) pair: more free people first, then more
   cuisine matches, then time and name. Only people free at a time count toward
   that time's cuisine match.
5. The host confirms an option; the session is marked decided.

## Layout

```
index.html              entry page
src/                    frontend (app.ts, api.ts, state.ts, style.css)
shared/                 types, decision logic, cuisine list, default restaurants
netlify/functions/api.ts   HTTP routing + validation
netlify/functions/lib/store.ts   Netlify Blobs access
test/decide.test.ts     unit tests
scripts/smoke.mjs       end-to-end API smoke test
```

## Data model (Netlify Blobs store `koulzeb`)

```
s:<sessionId>                 session meta (name, host, status, decision)
p:<sessionId>:<participantId> participant (free times, cuisines, suggestions)
r:<sessionId>:<restaurantId>  restaurant (name, cuisines, address, halal/vege)
```

Participants and restaurants are stored one-doc-per-item so concurrent submissions
never overwrite each other. Participant tokens are redacted from all responses.
New sessions are seeded with the default restaurant list in
`shared/seed-restaurants.ts`.

## Deliberate simplifications

- Polling every 5s instead of realtime push (Blobs is pull-based).
- Link-based access: anyone with the link can join; only the host can confirm.
- Times are time-of-day only (no dates), constrained to 30-minute slots.
- Map links are generated from name/address unless an explicit http(s) link is
  set; explicit links are validated to http(s) and re-guarded at render.
- Halal / Vege indicators on the seeded restaurants are best-effort guesses —
  correct them when adding or reviewing a restaurant.
