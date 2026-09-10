# KoulZeb — Continuity

Briefing for the next agent session. Newest entries first within each section.

## [PLANS]

- 2026-09-10 — `[USER]` Requested a design/implementation plan for KoulZeb, a
  Netlify dinner-planning app; approved the plan with "use defaults".
- 2026-09-10 — `[CODE]` Delivered MVP across 4 phases: scaffold, API+storage,
  decision logic + tests, frontend. Not yet deployed to a live Netlify site.

## [DECISIONS]

- 2026-09-10 — `[USER]` Round 7: switch the restaurant list to Google Places API,
  cap calls so it stays free, and guide setup.
- 2026-09-10 — `[TOOL]` Verified GMP pricing (updated 2026-09-01): Places Text
  Search free caps are IDs-only = unlimited, **Pro = 5,000**, **Enterprise =
  1,000** per month. Name/address/map-link needs Pro (5k); rating/price pushes to
  Enterprise (1k). So "10k free" is not achievable with usable fields.
- 2026-09-10 — `[ASSUMPTION]` Search runs server-side (key in
  `GOOGLE_PLACES_API_KEY`, never in the client), results cached 7 days, and a
  hard monthly cap `PLACES_MONTHLY_LIMIT` (default 5000) guards the bill. Static
  seed list removed; manual add/edit retained. rating/price opt-in via
  `PLACES_INCLUDE_RATING`.
- 2026-09-10 — `[USER]` Round 6: too much scrolling — put each section behind a tab.
- 2026-09-10 — `[ASSUMPTION]` Session page only: persistent header + banner, then
  sticky tabs (My picks / Places / Picks) showing one section at a time;
  `activeTab` resets on route change and survives polling. Home unchanged.
- 2026-09-10 — `[USER]` Round 5: redo the UI to be playful / child-like, to coax
  an indecisive friend into deciding each week.
- 2026-09-10 — `[ASSUMPTION]` UI-only change: emoji, chunky buttons, bright
  colors, friendly copy, a progress bar and a "still waiting on…" nudge. No
  logic or API changes; `app.ts` handlers and data attributes preserved.
- 2026-09-10 — `[USER]` Round 4: add a Google Maps link per restaurant and an
  option to edit restaurants.
- 2026-09-10 — `[ASSUMPTION]` Map links are generated from name/address unless an
  explicit http(s) link is set; explicit links are validated to http(s) on write
  and re-guarded at render (XSS). Any participant may edit any restaurant.
- 2026-09-10 — `[USER]` Round 3: times are time-of-day only (drop the date) and
  limited to 30-minute intervals.
- 2026-09-10 — `[ASSUMPTION]` Times are stored as "HH:MM" strings from a fixed
  48-slot set (`shared/times.ts`); no timezone math.
- 2026-09-10 — `[USER]` Round 2: add cuisine icons; let users choose times freely
  (no host-defined list); add Halal/Vege restaurant indicators; seed a default
  restaurant list.
- 2026-09-10 — `[ASSUMPTION]` Times are freely chosen per participant and matched
  by normalized (minute) instant; candidate times are the union of everyone's.
- 2026-09-10 — `[ASSUMPTION]` Cuisine icons are emoji; Halal/Vege flags on the
  seeded defaults are best-effort and should be verified.
- 2026-09-10 — `[USER]` Defaults locked: link-based identity (no accounts),
  per-session restaurant list, availability via host-proposed time slots,
  ranked results with host confirmation, no notifications, English UI.
- 2026-09-10 — `[ASSUMPTION]` Chose Netlify Blobs over a relational DB because
  Blobs is zero-config and the access pattern is document-shaped.
- 2026-09-10 — `[ASSUMPTION]` One document per participant/restaurant to avoid
  lost updates under concurrent writes (no ETag retry loop needed).
- 2026-09-10 — `[ASSUMPTION]` Polling (5s) instead of realtime; Blobs is pull-based.

## [PROGRESS]

- 2026-09-10 — `[TOOL]` Round 7: `typecheck`/`build` clean; `npm test` 12/12;
  `smoke` 27/27 (incl. places search 403/400/503 paths).
- 2026-09-10 — `[TOOL]` Round 6: `typecheck`/`build` clean; `npm test` 12/12;
  `smoke` 27/27; dev serves `/`, `/src/app.ts`, `/src/style.css` (200).
- 2026-09-10 — `[TOOL]` Round 5: `typecheck`/`build` clean; `npm test` 12/12;
  `smoke` 27/27; dev server serves `/`, `/src/app.ts`, `/src/style.css` (200).
- 2026-09-10 — `[TOOL]` Round 4: `npm test` → 12/12; `typecheck`/`build` clean;
  `npm run smoke` → 27/27.
- 2026-09-10 — `[TOOL]` Round 3: `npm test` → 8/8; `typecheck` and `build` clean;
  `npm run smoke` → 22/22.
- 2026-09-10 — `[TOOL]` Round 2: `npm test` → 7/7. `npm run typecheck` clean.
  `npm run build` clean. `npm run smoke` against `netlify dev` → 22/22.
- 2026-09-10 — `[TOOL]` `npm test` → 8/8 pass. `npm run typecheck` → clean.
  `npm run build` → clean. `npm run smoke` against `netlify dev` → 17/17 pass.
- 2026-09-10 — `[TOOL]` `netlify dev` loads function `api`; `/api/*` routes and
  `/` serves the Vite app.

## [DISCOVERIES]

- 2026-09-10 — `[USER]` "Session unavailable" on invites traced to a **stale
  round-1 frontend bundle** calling `session.timeSlots.map`; current source and a
  fresh `dist/` contain no `timeSlots`. Fix is a frontend redeploy/hard refresh,
  not a code change.
- 2026-09-10 — `[TOOL]` Netlify is **not linked/authenticated** in this
  workspace (`netlify status` → "Not logged in"), so deploys must be run by the
  user.

- 2026-09-10 — `[TOOL]` Node 24 runs `.ts` directly (type stripping), so unit
  tests need no test transpiler. Relative imports must include `.ts`.
- 2026-09-10 — `[TOOL]` Netlify's esbuild bundler follows imports from
  `netlify/functions/` into `shared/` at the repo root without extra config.
- 2026-09-10 — `[TOOL]` `netlify dev` generates a `deno.lock`; ignored, not needed.

## [OUTCOMES]

- 2026-09-10 — `[CODE]` Round 7 (Google Places search) committed on branch
  `agent/places-api`; needs `GOOGLE_PLACES_API_KEY` set in Netlify to function.
- 2026-09-10 — `[TOOL]` Round 6 (tabs) merged (fast-forward) into `main` and
  pushed to `origin`.
- 2026-09-10 — `[TOOL]` Round 5 (playful UI) merged (fast-forward) into `main`
  and pushed to `origin`.
- 2026-09-10 — `[TOOL]` Round 4 merged (fast-forward) into `main` and pushed to
  `origin`.
- 2026-09-10 — `[TOOL]` Fix merged (fast-forward) into `main` and pushed to
  `origin`. The stale invite error still requires a **frontend redeploy + hard
  refresh** to clear the old bundle; the code fix alone doesn't update clients.
- 2026-09-10 — `[CODE]` On `agent/fix-stale-invite-legacy`: `store.ts` coerces
  legacy participant/restaurant docs to the current shape; `netlify.toml` pins
  `NODE_VERSION = "22"` so Netlify builds don't silently fall back to old output.

- 2026-09-10 — `[TOOL]` Round 3 merged (fast-forward) into `main` and pushed to
  `origin`; branch `agent/time-only-half-hour` kept locally.
- 2026-09-10 — `[TOOL]` Round 2 merged (fast-forward) into `main` and pushed to
  `origin`; branch `agent/cuisines-free-time` kept locally.
- 2026-09-10 — `[CODE]` KoulZeb MVP committed on branch `agent/koulzeb-mvp`.
- 2026-09-10 — `[TOOL]` `main` fast-forwarded from the feature branch, pushed to
  `origin` (https://github.com/smuglilgoat/koulzeb). `main` tracks `origin/main`.
- 2026-09-10 — `[CODE]` Remaining: deploy to a real Netlify site; manual
  two-browser UX pass; consider configurable cuisine tags and timezone labels.
