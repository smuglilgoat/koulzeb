# Agent session — 2026-09-10 (round 7: Google Places search)

## Goal

Switch the restaurant list from a static seed to the Google Places API, keep
usage within the free tier, and document how to set it up.

## Outcome

Implemented and verified locally on branch `agent/places-api`. Requires
`GOOGLE_PLACES_API_KEY` in Netlify/local `.env` to return results.

## Pricing reality (verified against Google docs, updated 2026-09-01)

Places API (New) Text Search free caps are **per SKU**:
- IDs only — unlimited (no names)
- **Pro = 5,000/month** (id, name, address, map link, type)
- **Enterprise = 1,000/month** (adds rating, price level)

So the user's "10k free" is only true for ids-only. To keep names/address/map
links, the free cap is 5,000. Built accordingly.

## Changes

- `netlify/functions/lib/places.ts` (new) — server-side Text Search proxy:
  Pro field mask (rating/price opt-in), 7-day Blobs cache, hard monthly cap
  (`PLACES_MONTHLY_LIMIT`, default 5000), maps Google types to canonical cuisines.
- `netlify/functions/api.ts` — `GET /api/sessions/:id/places?q=` (auth required;
  2–80 char query).
- `netlify/functions/lib/store.ts` — removed default seeding.
- Deleted `shared/seed-restaurants.ts`.
- `shared/types.ts` — `PlaceResult`.
- `src/api.ts`, `src/app.ts` — search box in the Places tab; results with
  rating/price badges, map link and an "Add" button; manual add moved into a
  `<details>`.
- `.env.example` (new), `.gitignore` (` .env`), `README.md` setup guide,
  `scripts/smoke.mjs` updated (no seeds; places 403/400/503 checks).

## Commands run

```
npm run typecheck   # clean
npm test            # 12/12 pass
npm run build       # clean
npx netlify dev
npm run smoke       # 27/27 checks pass
```

## Follow-ups

- Merge/push, then set `GOOGLE_PLACES_API_KEY` in Netlify and redeploy.
- Existing sessions keep the previously seeded restaurants (stored in Blobs).
