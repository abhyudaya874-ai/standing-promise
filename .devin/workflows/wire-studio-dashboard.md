---
description: AG Studio dashboard with two custom widgets (verdict pill, promise scoreboard) fed by /api/studio/query
---

# AG Studio dashboard

In the reference code: `app/board/page.tsx`, `components/studio/{StudioBoard,registry}.tsx`, `widgets/{verdict-pill,scoreboard}.tsx`, `app/api/studio/query/route.ts`, `lib/studio/rows.ts`.

1. `npm install --save-exact ag-studio@3.1.0 ag-studio-react@3.1.0` (already in BOOTSTRAP). Free 45-day trial key from the AG Grid hackathon page; it works locally without one. Set `NEXT_PUBLIC_AG_STUDIO_KEY` if you have it.
2. `npm run dev`, create and settle two or three promises, open `/board`.
3. In Studio's edit mode add a **Verdict pill** widget and map `reason`; add a **Promise scoreboard** and map `payer` and `kind`. Add one built-in chart (verdicts by `reason`) and a grid. Cross-filter: click a bar.
4. Polish is judged: pick a theme, set a layout, name widgets, give the scoreboard a friendly look (it is the "nudge-bot scoreboard" story, not a collections report).
5. Custom widget rules (from the AG docs): a widget definition needs `id`, `label`, `comp`, `dataMapping`, `form`, `defaultSize`, `minSize`; the component reads its mapped field from `dataMapping.<key>.at(0)` and queries with `widgetApi.getData({ fields: [field], limit: { count: n } })`; rows are `res.results.rows`.
6. To add a widget: copy `verdict-pill.tsx`, add its definition to `registry.ts` (both `dataMapping` AND the `form` field item), then add its `TONE`/labels. Always typecheck: the compiler tells you which key is missing.

Cross-check the shape in `node_modules/ag-studio/dist/types/api/widgets/agWidgetDefinition.d.ts` if anything is unclear.
