# PRD: Gifting & Gifted Subscriptions

**Date:** 2026-09-19
**Status:** Implemented (V1.20)
**Related ADR:** [ADR 0002 — Gift Subscriptions via Batch + Recipients Model](../adr/0002-gift-subscriptions-batch-model.md)

## Problem
QSToolkit wants donors (philanthropists, firms, alumni) to pay subscriptions for students and
young QS professionals. The legacy `philanthropist_grants` flow supports one beneficiary per
payment, is keyed by raw email, exposes no privacy redaction, and has no analytics surface.

## Goals (P0 — must ship)
- [x] Public `/gifting` page — no login required; signup prompt woven into checkout flow.
- [x] Directory of giftable users: `user_type IN ('student','professional')`, `account_status='active'`, `is_verified=true`, no active paid subscription.
- [x] Privacy: display name is `First L.` (e.g. "Emmanuel N."); email partially redacted (`em***@domain.co`), full email never listed publicly.
- [x] Filter by account type (student / professional).
- [x] Donor can paste a full email to search and match a giftable user (server-side exact match; never leaks existence for non-matching emails).
- [x] Multi-select gifting — one payment (single Flutterwave charge) covers N recipients.
- [x] Monthly or annual billing cycle choice.
- [x] Donor identity: fully anonymous OR name + email + title + company + role + note ("why I chose to support young QS professionals").
- [x] Donor confirmation email when donor email provided.
- [x] Recipient gifting email on activation — donor name shown when available, else "an anonymous donor".
- [x] Dashboard sidebar link to `/gifting` (Community group).
- [x] Admin gifting analytics page (`/admin/gifting`) + backend stats endpoint.

## Answers to the open design questions
1. **How does a multi-user gift apply per user?** One `gift_batches` row (one payment) fans out
   into one `gift_recipients` row per beneficiary. Each recipient is activated independently
   (monthly +1 month, annual +1 year) by the shared finalize routine; failure of one recipient
   never blocks the others (per-row `status` + `failure_reason`).
2. **Flutterwave integration:** single charge with `metadata.product_type='gift_batch'` +
   `metadata.gift_batch_id`; activation runs in both the webhook (`charge.completed`) and the
   browser-return verify path, both idempotent via `payment_reference` uniqueness + per-recipient
   `activated_at` guards.
3. **Internal management:** `gift_batches` / `gift_recipients` give per-payment and per-user audit;
   `subscription_audit_log` entries record `gift_batch_id` in details; admins get aggregate +
   transaction-level analytics.

## P1 (post-V1.20)
- Pending-grant activation on beneficiary registration (legacy `philanthropist_grants` behaviour).
- Gift queue for unregistered emails (gift someone not yet on the platform).
- Donor leaderboard / public thank-you wall (opt-in).

## P2
- Recurring donor subscriptions (Flutterwave payment plans for gifts).
- Multi-currency donor checkout beyond existing country conversion.

## Non-goals
- No changes to self-serve subscription pricing or flows.
- No gifting of `enterprise` seats.
- Never display actively-subscribed users in the directory.

## Verification
- Backend unit tests: `backend/src/tests/giftSubscriptionService.test.js` (redaction format,
  eligibility SQL shape, per-recipient fan-out, idempotent finalize, anonymous email handling).
- Golden math: `count(recipients) × plan price == batch amount_ngn`.
