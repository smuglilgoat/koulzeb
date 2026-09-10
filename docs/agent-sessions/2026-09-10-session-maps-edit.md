# Agent session — 2026-09-10 (round 4: Google Maps links + restaurant editing)

## Goal

Add a Google Maps link to each restaurant and allow restaurants to be edited.

## Outcome

Implemented and verified locally on branch `agent/maps-link-edit`. Not merged
or pushed.

## Changes

- `shared/types.ts` — `Restaurant.mapUrl?: string`.
- `shared/maps.ts` (new) — `mapsUrl()`: explicit http(s) link if safe, else a
  Google Maps search from name + address.
- `netlify/functions/lib/store.ts` — `getRestaurant(sid, rid)`.
- `netlify/functions/api.ts` — `PATCH /api/sessions/:id/restaurants/:rid`; POST
  and PATCH validate that `mapUrl` is http(s).
- `src/api.ts` — `addRestaurant` takes `mapUrl`; new `editRestaurant`.
- `src/app.ts` — map links on each restaurant and each ranked option; inline
  restaurant edit form (shared `restaurantFields()` for add and edit).
- `src/style.css` — `.links`, `.map-link`, `.form-title`, `.restaurant.editing`.
- `test/maps.test.ts` (new, 4 tests); `scripts/smoke.mjs` extended.

## Commands run

```
npm run typecheck   # clean
npm test            # 12/12 pass (8 decide + 4 maps)
npm run build       # clean
npx netlify dev
npm run smoke       # 27/27 checks pass
```

## Notes

- Map links for the seeded restaurants are generated searches (no URLs were
  provided). Paste a specific Google Maps URL via Edit to override.
- Editing is a full replace of the editable fields (name, cuisines, address,
  map link, halal/vege); `rating`/`price` on seeded restaurants are preserved.
- Any participant can edit any restaurant.

## Follow-ups

- Merge/push if desired.
