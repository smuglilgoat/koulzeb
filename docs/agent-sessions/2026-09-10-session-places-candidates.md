# Agent session — 2026-09-10 (round 8: Places candidates from picks)

## Goal

Correct the Places integration: after a participant saves their picks, query
Google Places automatically and offer the top 10 places **per cuisine**, for the
participant to select from and add to the suggestion list.

## Outcome

Implemented and verified on branch `agent/places-candidates`. Needs
`GOOGLE_PLACES_API_KEY` to return real results (503 otherwise).

## Changes

- `shared/types.ts` — `SessionMeta.location?`.
- `netlify/functions/lib/places.ts` — `candidates(tags, location)`: one cached
  Text Search per `${tag} restaurant in ${location}`, top 10 in relevance order,
  partial results if the cap is hit mid-way.
- `netlify/functions/api.ts` — create accepts `location`;
  `GET /api/sessions/:id/places` now returns candidate groups from the caller's
  saved cuisines (empty if none, 409 if no location); new
  `PATCH /api/sessions/:id` sets the location.
- `src/api.ts` — `createSession` takes location; `getCandidates`, `setLocation`;
  removed `searchPlaces`.
- `src/app.ts` — create form includes city; header shows it; Places tab shows
  set-location form / prompt to pick cuisines / grouped candidates with
  checkboxes and "Add selected"; auto-fetches after saving choices and on opening
  the Places tab; manual add kept.
- `scripts/smoke.mjs` — location, candidate auth/409/503 checks (28 total).

## Commands run

```
npm run typecheck   # clean
npm test            # 12/12 pass
npm run build       # clean
npx netlify dev
npm run smoke       # 28/28 checks pass
```

## Follow-ups

- Merge/push, then set `GOOGLE_PLACES_API_KEY` in Netlify.
- "Top 10" is Google relevance order; ranking by rating needs the Enterprise
  field (free tier drops to 1,000/month).
