# ADR 0002: Gift Subscriptions via Batch + Recipients Model

## Status
Accepted (2026-09-19)

## Context
QSToolkit needs a public gifting page where anyone — including guests — can pay for one or more
users' subscriptions (student or professional accounts that are not already actively subscribed).
The existing `philanthropist_grants` table supports exactly one beneficiary per payment, is keyed
by raw beneficiary email, has no privacy redaction, and no analytics surface. Flutterwave is the
sole payment gateway and `charge.completed` webhooks plus browser-return `/subscriptions/verify`
are both active completion paths for payments.

## Decision
Introduce a **gift batch + recipients** model instead of extending `philanthropist_grants`:

- `gift_batches` — one row per donor checkout: donor identity (nullable for anonymity),
  plan, billing cycle, amount, payment status, Flutterwave reference (unique).
- `gift_recipients` — one row per beneficiary with `status`
  (`pending → activated | failed | removed`), `activated_at`, `expires_at`, and a
  `gift_message` snapshot so later donor/plan changes never corrupt history.
- One Flutterwave charge per batch (`tx_prefix: 'gift'`) with
  `metadata.product_type = 'gift_batch'` and `metadata.gift_batch_id`; both the webhook and the
  verify endpoint finalize the batch through one shared, idempotent service routine.
- A **giftable directory query** that only exposes users who are active, verified, of type
  student/professional, and without an active paid subscription. All listing responses are
  redacted server-side (`First L.` display name, partial email). Full-email donor search is a
  separate, exact-match endpoint that never confirms existence of non-matching users.
- Recipient activation reuses the same activation primitive as self-serve subscriptions and
  writes `subscription_audit_log` entries with `gift_batch_id` in details.

## Consequences
- **Positive:** multi-recipient gifting in one payment; per-recipient failure isolation;
  privacy-preserving directory; clean analytics surface (revenue, donors, anonymouse share,
  top recipients); consistent with existing webhook/verify dual-path pattern.
- **Negative:** two new tables + finalization routine to maintain; directory must be indexed
  and paginated to stay cheap; redaction logic becomes security-critical.
- **Mitigations:** per-recipient `activated_at` guard + unique `payment_reference` for
  idempotency; server-side-only redaction (frontend never receives raw data); rate limits on
  public endpoints; `generalLimiter` + dedicated `paymentLimiter` on checkout.

## Alternatives considered
1. **Loop over `philanthropist_grants`** — rejected: N grant rows → N separate Flutterwave
   charges (donor pays N times, N references to reconcile), no batch analytics.
2. **JSON column of beneficiary emails on one grant row** — rejected: no per-recipient state
   machine, no per-recipient audit, unqueryable for analytics.
