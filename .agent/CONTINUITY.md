# KoulZeb — Continuity

Briefing for the next agent session. Newest entries first within each section.

## [PLANS]

- 2026-09-10 — `[USER]` Requested a design/implementation plan for KoulZeb, a
  Netlify dinner-planning app; approved the plan with "use defaults".
- 2026-09-10 — `[CODE]` Delivered MVP across 4 phases: scaffold, API+storage,
  decision logic + tests, frontend. Not yet deployed to a live Netlify site.

## [DECISIONS]

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

- 2026-09-10 — `[TOOL]` Round 2: `npm test` → 7/7. `npm run typecheck` clean.
  `npm run build` clean. `npm run smoke` against `netlify dev` → 22/22.
- 2026-09-10 — `[TOOL]` `npm test` → 8/8 pass. `npm run typecheck` → clean.
  `npm run build` → clean. `npm run smoke` against `netlify dev` → 17/17 pass.
- 2026-09-10 — `[TOOL]` `netlify dev` loads function `api`; `/api/*` routes and
  `/` serves the Vite app.

## [DISCOVERIES]

- 2026-09-10 — `[TOOL]` Node 24 runs `.ts` directly (type stripping), so unit
  tests need no test transpiler. Relative imports must include `.ts`.
- 2026-09-10 — `[TOOL]` Netlify's esbuild bundler follows imports from
  `netlify/functions/` into `shared/` at the repo root without extra config.
- 2026-09-10 — `[TOOL]` `netlify dev` generates a `deno.lock`; ignored, not needed.

## [OUTCOMES]

- 2026-09-10 — `[CODE]` Round 2 committed on branch `agent/cuisines-free-time`
  (not merged/pushed — awaiting instruction).
- 2026-09-10 — `[CODE]` KoulZeb MVP committed on branch `agent/koulzeb-mvp`.
- 2026-09-10 — `[TOOL]` `main` fast-forwarded from the feature branch, pushed to
  `origin` (https://github.com/smuglilgoat/koulzeb). `main` tracks `origin/main`.
- 2026-09-10 — `[CODE]` Remaining: deploy to a real Netlify site; manual
  two-browser UX pass; consider configurable cuisine tags and timezone labels.
