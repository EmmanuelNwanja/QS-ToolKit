# QSToolkit Release Rollout (Milestones + Admin + PDF + Plans)

## Apply Order
1. Backup database and export current `subscription_plans`, `users`, `projects`, `leaderboard`.
2. Apply SQL migrations in this exact order:
1. database/migrations/001_initial_schema.sql
2. database/migrations/002_boq_invoices.sql
3. database/migrations/003_feedback_leaderboard.sql
4. database/migrations/004_lint_fixes.sql
5. database/migrations/005_lint_fixes_round2.sql
6. database/migrations/006_pricing_promos_philanthropist.sql
7. database/migrations/007_admin_dashboard.sql
8. database/migrations/008_billing_audit_system.sql
9. database/migrations/009_auth_verification_and_identity_controls.sql
10. database/migrations/010_leaderboard_count_active_projects.sql
11. database/migrations/011_leaderboard_privacy_and_value_fix.sql
12. database/migrations/012_project_milestones.sql
13. database/migrations/013_plan_refresh_basic_pro_enterprise.sql
14. database/migrations/014_leaderboard_value_parity_refresh.sql
15. database/migrations/015_rollout_checklist.sql
16. database/migrations/016_boq_invoice_monthly_limits.sql
3. Run seed refresh:
1. database/seeds/001_seed_plans.sql
4. Deploy backend.
5. Deploy frontend.

## Post-Deploy Verification
1. Admin dashboard:
1. Super admin sees full metrics.
2. Regular admin sees scoped metrics and no frontend crash.
2. Projects and milestones:
1. Create milestone with note.
2. Update status to in_progress and completed.
3. Delete milestone.
3. Invoices / quotations / valuations:
1. Create each type successfully (Basic plan user should be able to create up to 2 per type per month).
2. On the 3rd attempt of the same type on Basic plan, expect a 402 INVOICE_LIMIT_REACHED error.
3. If PDF runtime unavailable, create still succeeds and export/send shows retry message.
4. BOQ exports:
1. Basic plan user can create BOQs (up to 2/month); expect 402 BOQ_LIMIT_REACHED on the 3rd.
2. Excel export succeeds.
2. PDF export succeeds or returns retryable PDF_UNAVAILABLE message.
5. Calculators:
1. Run calculators and verify raw calculation toggle.
2. Save result and verify item appears under Saved Calculations list.
6. Leaderboard parity:
1. For sample users, compare dashboard total value with leaderboard total_project_value.
7. Plans:
1. Confirm Student renamed to Basic in UI.
2. Confirm limits match release values:
1. Basic: 30 calculator, 2 projects, 2 BOQ, 2 invoice/valuation/quotation, PDF+Excel, 1 user/1 device.
2. Pro: 80 calculator, 5 projects, 5 BOQ, 5 invoice/valuation/quotation, PDF+Excel, 1 user/2 devices.
3. Enterprise: 700 calculator, 50 projects, 50 BOQ, 50 invoice/valuation/quotation, PDF+Excel, 5 users/15 devices.

## Rollback Notes
1. If frontend breaks only, rollback frontend deploy and keep backend/db.
2. If backend breaks after migrations, keep DB and rollback backend to previous stable commit.
3. If migration 013 causes plan issues, hotfix by restoring `subscription_plans` from backup and reapplying adjusted migration.
4. If leaderboard mismatch persists, rerun migration 014 and call `refresh_leaderboard()`.
