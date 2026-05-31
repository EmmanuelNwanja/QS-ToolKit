# Rollback & Data Safety Plan

## 1. Feature Disable Checklist

### Step 1: Disable the feature flag
```bash
# Backend: unset or set to false
export PARAMETRIC_ENGINE_ENABLED=false

# Frontend: unset or set to false
export NEXT_PUBLIC_PARAMETRIC_ENGINE_ENABLED=false
```

### Step 2: Revert database migration
```bash
# Run the down migration to drop module-isolated tables
# and recreate legacy 034/035 tables
# (Make sure to use the correct Supabase/DB client)
psql $DATABASE_URL -f database/migrations/036_parametric_module_isolated.sql
# Then run the down() portion manually:
#   DROP TABLE IF EXISTS mod_parametric_audit_trail CASCADE;
#   DROP TABLE IF EXISTS mod_parametric_calculations CASCADE;
#   DROP TABLE IF EXISTS mod_parametric_rules CASCADE;
#   DROP TABLE IF EXISTS mod_parametric_element_types CASCADE;
#   (then run 034.sql and 035.sql to recreate legacy tables if needed)
```

### Step 3: Remove parametric frontend routes (or hide behind flag)
- Verify that `NEXT_PUBLIC_PARAMETRIC_ENGINE_ENABLED=false` in all environments
- When false, the page at `frontend/src/pages/projects/[id]/parametric.jsx` shows a "disabled" message instead of the calculator
- The sidebar nav item (if added) must be gated by the same flag
- The BOQ page "Generate with Parametric Engine" button (if added) must be gated by the same flag

### Step 4: Remove backend module mount
```bash
# Delete or comment out the conditional mount in backend/src/app.js:
# if (process.env.PARAMETRIC_ENGINE_ENABLED === 'true') { ... }

# Or simply delete the entire module:
rm -rf backend/modules/parametric/
# The app.js try/catch handles this gracefully — no crash
```

## 2. Zero-API Guarantee After Rollback

After rollback:
- No `/api/v1/parametric/*` endpoints are reachable (app.js does not mount them)
- No `mod_parametric_*` DB tables are queried (migration reverted)
- No parametric UI renders (feature flag off → disabled state)
- No parametric JS bundle loads (Next.js dynamic import + flag gate)

## 3. Data Isolation Proof

### Legacy `boq_lines` table — UNTOUCHED
```sql
-- No new columns added to boq_lines
SELECT column_name FROM information_schema.columns
WHERE table_name = 'boq_lines';
-- Returns only the original columns. No parametric-specific columns.

-- No new foreign keys pointing TO boq_lines
SELECT conname, confrelid::regclass
FROM pg_constraint
WHERE confrelid = 'boq_lines'::regclass;
-- Empty result set — no FKs reference boq_lines from parametric tables.
```

### Injected parametric lines are JUST NEW ROWS
```sql
-- Parametric BOQ injection uses the existing boq_lines INSERT API.
-- Injected lines are indistinguishable from manually created lines:
--   - Same table: boq_lines
--   - Same columns: item_no, description, unit, quantity, rate, amount
--   - No proprietary flags, no parametric badge, no lock-in
--   - No "source=parametric" column exists
--   - After injection, parametric module can be deleted and lines persist
SELECT * FROM boq_lines WHERE boq_document_id = '<target-boq-id>' ORDER BY item_no;
```

## 4. Environment Separation

Required env vars are documented in:
- `backend/.env.example.parametric`
- `frontend/.env.example.parametric`

The app starts successfully without these vars:
- Backend: defaults to `PARAMETRIC_ENGINE_ENABLED=false` (no parametric routes)
- Frontend: defaults to `NEXT_PUBLIC_PARAMETRIC_ENGINE_ENABLED=false` (no parametric UI)
- Error: no crash, no console errors — graceful degradation

## 5. Feature Flag Admin Toggle

An admin API endpoint exists at:
```
GET /api/v1/parametric/admin/status
POST /api/v1/parametric/admin/toggle
```

These return/set the current `PARAMETRIC_ENGINE_ENABLED` value in the runtime environment.
**Note:** This toggle is in-memory only and resets on deploy. For permanent per-tenant control,
integrate with the existing `platform_settings` or `tenant_settings` table via the admin panel.

## 6. Cleanup After Rollback

```bash
# Delete parametric module
rm -rf backend/modules/parametric/
rm -rf frontend/src/components/parametric/
rm -rf frontend/src/pages/projects/[id]/parametric.jsx

# Remove env files (optional)
rm backend/.env.example.parametric
rm frontend/.env.example.parametric
```
