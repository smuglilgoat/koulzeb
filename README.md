# KoulZeb

Plan a group dinner out, together. Propose a few times, share one link, and let
everyone pick the times they're free and the cuisines they like. KoulZeb crosses
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

1. Host creates a session and proposes 1–20 candidate times.
2. Host shares the link (`/#/s/<id>`); guests join with just a name.
3. Each participant marks which times they're free and which cuisines they like,
   and can add restaurants.
4. The API ranks every (time, restaurant) pair: more free people first, then more
   cuisine matches, then name. Only people free at a time count toward that
   time's cuisine match.
5. The host confirms an option; the session is marked decided.

## Layout

```
index.html              entry page
src/                    frontend (app.ts, api.ts, state.ts, style.css)
shared/                 types, decision logic, cuisine list (used by both sides)
netlify/functions/api.ts   HTTP routing + validation
netlify/functions/lib/store.ts   Netlify Blobs access
test/decide.test.ts     unit tests
scripts/smoke.mjs       end-to-end API smoke test
```

## Data model (Netlify Blobs store `koulzeb`)

```
s:<sessionId>                 session meta (name, host, times, status, decision)
p:<sessionId>:<participantId> participant (availability, cuisines, suggestions)
r:<sessionId>:<restaurantId>  restaurant (name, cuisines, address)
```

Participants and restaurants are stored one-doc-per-item so concurrent submissions
never overwrite each other. Participant tokens are redacted from all responses.

## Deliberate simplifications

- Polling every 5s instead of realtime push (Blobs is pull-based).
- Link-based access: anyone with the link can join; only the host can confirm.
- Time slots are stored as UTC and rendered in the viewer's local timezone.
