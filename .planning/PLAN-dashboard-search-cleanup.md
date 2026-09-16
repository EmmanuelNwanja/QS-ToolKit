# Plan: Dashboard Search, Coming Soon, AI Cleanup & Dashboard Rebuild

## Context
The QSToolkit dashboard needs a global search bar, sidebar items marked "coming soon" should be visually disabled, AI marketing fluff needs cleanup, and the dashboard should be rebuilt with cleaner Ant Design-inspired admin patterns (using existing Tailwind).

## Constraints
- **No new dependencies** -- keep Tailwind, no antd
- **No breaking changes** -- existing routes, APIs, and features must work
- **Smart Parametric** is env-gated; Academy & Exam Prep are fully built but should appear "coming soon" in sidebar

---

## Phase 1: Global Search Bar

### Files to modify
- `frontend/src/components/Layout.jsx` -- add search bar to top header
- `frontend/src/components/GlobalSearch.jsx` -- NEW component

### Implementation
1. Create `GlobalSearch.jsx`:
   - Search input with magnifying glass icon (SVG, not emoji)
   - Keyboard shortcut: Cmd/Ctrl+K to open
   - Search across: projects (by title/client), calculators (by label), recent invoices
   - Dropdown results with categories, links to relevant pages
   - Uses existing `projectAPI.list()`, `CALCULATORS` from helpers
   - Debounced input (300ms), client-side filtering for calculators/projects already loaded
   - If no results, show "No results found" with suggestion to try different terms

2. Add to `Layout.jsx` header:
   - Place between title and notification bell
   - Render as a trigger button (search icon + "Search..." placeholder) that opens the search overlay
   - On mobile: full-width input in header

### Styling
- Use existing `.input` class for the search field
- Results dropdown: existing `.card` styling
- Keyboard shortcut badge: existing `.badge-gray` class

---

## Phase 2: Sidebar "Coming Soon" Items

### Files to modify
- `frontend/src/components/Layout.jsx` -- NAV_ITEMS + nav rendering
- `frontend/src/styles/globals.css` -- add `.nav-link-coming-soon` class

### Implementation
1. Add `comingSoon: true` to NAV_ITEMS for:
   - `{ href: '/academy', icon: '🎓', label: 'QS Academy', comingSoon: true }`
   - `{ href: '/exam-prep', icon: '📝', label: 'Exam Prep', comingSoon: true }`
   - Smart Parametric (add it unconditionally with `comingSoon: true`, remove env var gate)

2. Modify nav rendering:
   - If `item.comingSoon`: render as `<span>` instead of `<Link>`
   - Apply `opacity-50 cursor-not-allowed` styling
   - Show "Coming Soon" badge (similar to existing "Locked" badge but gray)

3. Add CSS class:
   ```css
   .nav-link-coming-soon {
     @apply opacity-50 cursor-not-allowed pointer-events-none;
   }
   ```

---

## Phase 3: Remove "Coming Soon" Items from Dashboard

### Files to modify
- `frontend/src/pages/dashboard.jsx`

### Implementation
1. Remove the QS Academy card (lines 246-283)
2. Remove the Exam Prep card (lines 286-301)
3. Keep: Welcome banner, stat cards, usage meter, recent projects, Dr. Q Assistant, AI Tools, Quick Calculators
4. Adjust grid: change right sidebar from `lg:col-span-2` to fill available space with remaining items

---

## Phase 4: AI Fluff/Slop Cleanup

### Files to modify
- `frontend/src/pages/_document.jsx` -- meta titles
- `frontend/src/pages/index.jsx` -- landing page meta
- `frontend/src/pages/dashboard.jsx` -- title tag
- `frontend/src/pages/engine.jsx` -- title tag
- `frontend/src/pages/calculators/index.jsx` -- title tag
- `frontend/src/utils/helpers.js` -- comment separators
- `frontend/src/components/Layout.jsx` -- comment separators

### Changes
1. **Title tags** -- replace em-dash with pipe or dash:
   - `"Dashboard — QSToolkit"` → `"Dashboard | QSToolkit"`
   - `"AI Engine — Dr. Q — QSToolkit"` → `"Engine | QSToolkit"`
   - `"70+ QS Calculators — QSToolkit"` → `"Calculators | QSToolkit"`
   - Landing page: `"QSToolkit — Quantity Surveying..."` → `"QSToolkit - Quantity Surveying..."`

2. **Meta descriptions** -- same em-dash cleanup in `_document.jsx` and `index.jsx`

3. **Comment separators** -- replace `// ─── AI ─────` with `// ---` or remove entirely

4. **Functional AI references** -- KEEP these (they are features, not fluff):
   - Dr. Q Assistant card on dashboard
   - AI Engine nav item and page
   - AI Tools Quick Access section
   - Auto-BOQ, Cost Forecast, Variance tools

5. **Marketing AI text** -- tone down where it's pure marketing:
   - `"AI-powered learning pathways"` → `"Learning pathways"` (in Academy card -- but this is being removed from dashboard anyway)
   - `"AI explanations"` → `"Detailed explanations"` (Exam Prep -- also removed from dashboard)

---

## Phase 5: Dashboard Rebuild (Ant Design Patterns)

### Files to modify
- `frontend/src/pages/dashboard.jsx`
- `frontend/src/styles/globals.css` -- minor additions

### Design Principles (from Ant Design admin patterns)
1. **Clear visual hierarchy** -- stat cards at top, primary content in main area, secondary in sidebar
2. **Consistent card styling** -- all cards use same border radius, padding, shadow
3. **Proper spacing** -- consistent gap values (gap-4, gap-6)
4. **No emoji icons in stat cards** -- use colored dots/icons instead
5. **Better empty states** -- descriptive empty states with clear CTAs
6. **Loading skeletons** -- keep existing skeleton pattern

### Rebuilt Layout
```
┌─────────────────────────────────────────────┐
│ Welcome Banner (gradient)                    │
├──────┬──────┬──────┬────────────────────────┤
│Stats │Stats │Stats │ Stats                  │
├──────┴──────┴──────┴────────────────────────┤
│ Usage Meter (if applicable)                  │
├──────────────────────┬──────────────────────┤
│ Recent Projects      │ Dr. Q Assistant       │
│ (main content)       │ Quick Calculators     │
│                      │ AI Tools              │
├──────────────────────┴──────────────────────┤
```

### Specific Changes
1. **Stat cards**: Remove emoji icons, use colored top border or left border accent
2. **Welcome banner**: Keep as-is (already clean)
3. **Usage meter**: Keep as-is (functional)
4. **Recent projects**: Keep as-is (functional)
5. **Right sidebar**: Keep Dr. Q + AI Tools + Quick Calculators (remove Academy/Exam Prep)
6. **Title tag**: Clean em-dash

---

## Phase 6: Script Review

### Files to review
- `scripts/gate-check.mjs` -- already reviewed, looks correct
- `scripts/setup-triage-labels.mjs` -- quick check

### Findings
- `gate-check.mjs`: No bugs found. Logic is sound. Uses top-level await correctly.
- Will run lint after all changes to verify no regressions.

---

## Execution Order

1. Phase 2 (Sidebar coming soon) -- smallest change, no new files
2. Phase 4 (AI fluff cleanup) -- text-only changes across files
3. Phase 3 (Remove coming soon from dashboard) -- dashboard simplification
4. Phase 5 (Dashboard rebuild) -- structural changes to dashboard
5. Phase 1 (Global search) -- new component + Layout integration
6. Phase 6 (Script review) -- verification

## Verification

1. Run `npm run lint` in `frontend/` after each phase
2. Visual check: sidebar shows coming soon items greyed out
3. Visual check: dashboard has no Academy/Exam Prep cards
4. Visual check: search bar works in header
5. Run `node scripts/gate-check.mjs` at the end
