# Flutterwave Subscriptions + Cancel/Upgrade + Zeptomail — Implementation Plan

## Goal
1. Enable true auto-recurring subscriptions via Flutterwave's billing API
2. Fix cancel flow (keep access until expiry, cancel on gateway, send email)
3. Add self-service upgrade/downgrade (immediate swap, no proration)
4. Add Zeptomail as email provider + send confirmation/cancel/upgrade emails
5. Tag all transactions with `project: 'qstoolkit'` for multi-project accounting

---

## 1. Multi-Project Accounting (Metadata Tagging)

Tag every transaction with `project: 'qstoolkit'` in the `billing_transactions.metadata` JSON column.

- **`paymentGateway.js` → `initializePayment()`** — add `project: 'qstoolkit'` to metadata passed to Flutterwave/Paystack
- **`subscriptionController.js` → `recordBillingTransactionOnce()`** — persist `project` in metadata
- **Backfill**: `UPDATE billing_transactions SET metadata = metadata || '{"project": "qstoolkit"}'::jsonb WHERE metadata->>'project' IS NULL;`

---

## 2. Prerequisites (Manual)

### 2a. Create Flutterwave Plans
Create one plan per billing cycle in the [Flutterwave Dashboard](https://dashboard.flutterwave.com):
- Basic (monthly), Basic (annual), Pro (monthly), Pro (annual), Enterprise (monthly), Enterprise (annual)

Note each plan's `id` — stored in `subscription_plans` table.

### 2b. Supabase Migration

```sql
-- Migration 031: Flutterwave subscriptions + cancel/upgrade support
BEGIN;

-- Flutterwave plan mapping
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS flutterwave_plan_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS flutterwave_plan_id_annual VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_flw_plan
  ON subscription_plans(flutterwave_plan_id) WHERE flutterwave_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_plans_flw_plan_annual
  ON subscription_plans(flutterwave_plan_id_annual) WHERE flutterwave_plan_id_annual IS NOT NULL;

-- Flutterwave customer/subscription token storage
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS flutterwave_customer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS flutterwave_subscription_id VARCHAR(100);

COMMIT;
```

### 2c. Zeptomail Environment Variables

Add to `.env.example`:
```
# Zeptomail (Email)
ZEPTOMAIL_API_KEY=your-zeptomail-api-key
ZEPTOMAIL_SENDER_EMAIL=noreply@qstoolkit.com
ZEPTOMAIL_SENDER_NAME=QSToolkit
```

---

## 3. Backend Changes

### A. `emailService.js` — Add Zeptomail provider

Add `'zeptomail'` as a new provider in the `send()` function's provider switch:

```js
// Zeptomail API: POST https://api.zeptomail.in/v1.1/email
async function sendViaZeptomail({ to, subject, html, text }) {
  const res = await axios.post('https://api.zeptomail.in/v1.1/email', {
    from: { address: process.env.ZEPTOMAIL_SENDER_EMAIL, name: process.env.ZEPTOMAIL_SENDER_NAME },
    to: to.map(addr => ({ email_address: { address: addr } })),
    subject,
    htmlbody: html,
    textbody: text
  }, {
    headers: { 'Authorization': `Zoho-encmt ${process.env.ZEPTOMAIL_API_KEY}`, 'Content-Type': 'application/json' }
  });
  return res.data;
}
```

Add to provider selection: `case 'zeptomail': return sendViaZeptomail(...)`.

Add new email templates:
- `sendSubscriptionCancellation(user, expiresAt)` — confirms cancel, access until date
- `sendPlanChangeConfirmation(user, oldPlan, newPlan, billingCycle)` — confirms upgrade/downgrade

### B. `paymentGateway.js` — Flutterwave subscription API helpers + project tag

Add functions:
```js
async function flutterwaveCreateSubscription({ email, flwPlanCode, txRef, startDate }) { ... }
async function flutterwaveCancelSubscription(subscriptionId) { ... }
async function flutterwaveGetSubscription(subscriptionId) { ... }
```

In `initializePayment()`, add `project: 'qstoolkit'` to the metadata object.

Export new functions alongside existing ones.

### C. `subscriptionController.js` — Full rewrite of cancel + new upgrade endpoint

#### C1. Fix `cancelMySubscription` (current bug: revokes access immediately)

Current flow sets `subscription_status = 'cancelled'` but middleware treats `cancelled` as expired → instant lockout.

**New flow:**
1. If user has `flutterwave_subscription_id`, call `flutterwaveCancelSubscription()` to stop future charges
2. If user has `paystack_subscription_code`, call Paystack cancel API to stop future charges
3. Set `subscription_status = 'cancelled'` (keep `subscription_expires_at` unchanged — access remains until then)
4. Set `auto_renew = false`
5. Sync `user_subscriptions` table
6. Send cancellation email via `emailService.sendSubscriptionCancellation()`
7. Log audit entry

**Middleware fix** (`subscriptionMiddleware.js`):
Change `isSubscriptionCurrentlyValid()` to treat `cancelled` as valid if `subscription_expires_at > now`:
```js
if (user.subscription_status === 'cancelled') {
  return user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
}
```

#### C2. Add `changePlan` handler (upgrade/downgrade)

New endpoint: `POST /subscriptions/change-plan`

**Logic:**
1. Validate new plan exists and is active
2. If upgrading (new plan price > current plan price):
   - Initialize a payment for the new plan amount
   - Return `authorization_url` for the user to complete payment
   - On payment success (via webhook/verify), call `activateSubscription()` which swaps the plan and resets expiry from today
3. If downgrading (new plan price < current plan price):
   - Immediate swap, no payment needed
   - `activateSubscription()` resets expiry from today (user loses remaining time on old plan — acceptable for no-proration model)
4. If same plan: no-op

**Simplification**: Both upgrade and downgrade are immediate plan swaps. Upgrade requires payment first. No proration, no credit, no deferred changes.

#### C3. Modify `initiate` handler
Add `project: 'qstoolkit'` to all payment metadata.

If plan has `flutterwave_plan_id` mapped, include in metadata:
```js
requires_flutterwave_recurring: true,
flutterwave_plan_id: mappedPlanId,
```

#### C4. Modify `flutterwaveWebhook` handler
After `charge.completed` for core platform subscriptions:
1. If `meta.requires_flutterwave_recurring` → create Flutterwave subscription, store tokens
2. Handle new events: `subscription.completed`, `.expired`, `.cancelled`, `.active`

#### C5. Modify `verify` handler
After successful verification, send confirmation email via `emailService.sendSubscriptionConfirmation()`.

### D. `schedulerService.js` — Skip Flutterwave users

In `autoRenewSubscriptions()`:
- Skip users with `flutterwave_subscription_id` set (Flutterwave handles renewal via its own API)
- Log: "User {id} has Flutterwave recurring — skipped"

### E. Routes

Add to `subscriptionRoutes.js`:
```js
router.post('/change-plan', paymentLimiter, [
  body('new_plan_name').trim().notEmpty().withMessage('new_plan_name is required'),
  validate
], ctrl.changePlan);
```

---

## 4. Frontend Changes

### `subscription.jsx`
- For current subscribers, change "Current Plan" badge to a button group: "Current Plan" + "Upgrade" / "Downgrade" links
- "Upgrade" → calls `changePlan(newPlanName)` → redirects to payment URL
- "Downgrade" → calls `changePlan(newPlanName)` → shows confirmation toast

### `settings/index.jsx`
- Fix cancel button messaging: "Access remains until [expiry date]" (accurate now)
- Fix the `confirm()` dialog text to match actual behavior

### `services/api.js`
Add:
```js
changePlan: (newPlanName) => api.post('/subscriptions/change-plan', { new_plan_name: newPlanName })
```

---

## 5. Execution Order

| Step | File | Change |
|------|------|--------|
| 1 | `database/migrations/031_flutterwave_and_plan_changes.sql` | Migration — plan IDs, token columns |
| 2 | `backend/.env.example` | Add Zeptomail env vars |
| 3 | `backend/src/services/emailService.js` | Add Zeptomail provider + cancellation/change-plan templates |
| 4 | `backend/src/services/paymentGateway.js` | Add 3 Flutterwave subscription functions + project tag |
| 5 | `backend/src/controllers/subscriptionController.js` | Fix cancel, add changePlan, modify initiate/webhook/verify |
| 6 | `backend/src/middlewares/subscriptionMiddleware.js` | Fix cancelled-status check to respect expiry date |
| 7 | `backend/src/routes/subscriptionRoutes.js` | Add `/change-plan` route |
| 8 | `backend/src/services/schedulerService.js` | Skip Flutterwave users in auto-renew |
| 9 | `frontend/src/services/api.js` | Add `changePlan()` API call |
| 10 | `frontend/src/pages/subscription.jsx` | Add upgrade/downgrade buttons for current subscribers |
| 11 | `frontend/src/pages/settings/index.jsx` | Fix cancel button text |
| 12 | Manual | Create Flutterwave plans, update `subscription_plans` rows, run backfill SQL |

---

## 6. Verification

1. Run migration
2. Update `subscription_plans` with Flutterwave plan IDs
3. **Cancel flow**: Cancel subscription → verify access continues until expiry → verify gateway subscription cancelled → verify cancellation email received
4. **Upgrade flow**: On Basic, click "Upgrade to Pro" → pay → verify plan swaps immediately with new expiry
5. **Downgrade flow**: On Pro, click "Downgrade to Basic" → confirm → verify immediate swap
6. **Flutterwave recurring**: Subscribe → verify webhook creates recurring subscription → verify `flutterwave_subscription_id` stored
7. **Auto-renew cron**: Verify Flutterwave users are skipped
8. **Emails**: Verify confirmation, cancellation, and plan-change emails are sent
9. **Project tagging**: Verify `billing_transactions.metadata->>'project' = 'qstoolkit'` on new transactions
