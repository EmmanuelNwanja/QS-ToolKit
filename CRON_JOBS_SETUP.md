<!-- CRON_JOBS_SETUP.md: Complete Configuration & Activation Guide -->

# Cron Jobs Setup & Activation Guide

This document provides step-by-step instructions to configure and activate all cron jobs in QSToolkit, including the new auto-renewal functionality.

## Overview of Cron Jobs

The system runs the following scheduled jobs **daily at 8:00 AM West Africa Time (WAT = UTC+1)**:

| Job | Purpose | Status | Trigger |
|-----|---------|--------|---------|
| `expireSubscriptions()` | Mark subscriptions as inactive when they reach expiry date | ✅ Existing | Daily 8 AM WAT |
| `sendExpiryReminders()` | Email users whose subscription expires in 3 days | ✅ Existing | Daily 8 AM WAT |
| `autoRenewSubscriptions()` | **NEW** — Auto-charge users with `auto_renew=true` | ✅ New | Daily 8 AM WAT |
| `refreshLeaderboard()` | Refresh leaderboard rankings | ✅ Existing | Daily 8 AM WAT |

---

## Architecture: Two Execution Methods

You can run cron jobs using **either** method:

### Method 1: GitHub Actions (Recommended for Production)
- **Trigger**: External HTTP POST to your backend's cron endpoint
- **Advantage**: Decoupled from application process; survives app restarts
- **Disadvantage**: Requires GitHub Actions configuration

### Method 2: Inline Cron with node-cron (Development/Self-Hosted)
- **Trigger**: Runs inside the Node.js process on a schedule
- **Advantage**: No external service needed; simple setup
- **Disadvantage**: Job is lost if app crashes/restarts

---

## Setup Instructions

### Step 1: Apply Database Migration

Before running any auto-renewal job, you must create the tracking table:

```bash
# In your Supabase dashboard or via psql:
# 1. Go to SQL Editor in Supabase Console
# 2. Create a new query
# 3. Copy the entire contents of database/migrations/020_subscription_renewal_tracking.sql
# 4. Execute it

# OR via command line (if you have Supabase CLI):
supabase migration up
```

**Migration creates:**
- `subscription_renewal_attempts` table (tracks all renewal attempts)
- Indexes for fast lookups and admin debugging

⚠️ **Critical**: Do NOT proceed without this table — the auto-renewal service will fail silently if the table doesn't exist.

---

### Step 2: Set Required Environment Variables

All cron jobs require these variables in your `.env` file (backend):

```env
# === Paystack Configuration ===
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx          # Your Paystack secret key

# === Email Configuration ===
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxx                  # SendGrid API key (for reminders)

# === Frontend URL (for email links) ===
FRONTEND_URL=https://yourapp.com                      # Used in email reminders/confirmations

# === Cron Security (if using GitHub Actions) ===
CRON_SECRET=your_secret_token_here                    # Bearer token for GitHub Actions
# Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

# === Optional: Node Cron Timezone (Development) ===
TZ=Africa/Lagos                                        # For inline cron if not using GitHub Actions
```

**How to generate a secure CRON_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123def456...
# Copy this value to CRON_SECRET= in your .env
```

---

### Step 3: Enable Inline Cron (for Development/Self-Hosted)

If you are **NOT** using GitHub Actions and want cron to run inside your Node.js process:

**File**: `backend/src/server.js`

Add this after your app starts listening:

```javascript
const app = require('./app');
const logger = require('./utils/logger');
const { startCron } = require('./services/schedulerService');

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🔧 QSToolkit API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  
  // ✅ START INLINE CRON if not using GitHub Actions
  if (process.env.RUN_CRON_INLINE === 'true') {
    startCron();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
```

Then add to `.env`:

```env
RUN_CRON_INLINE=true    # Enable inline cron scheduling
```

---

### Step 4: Test Cron Jobs Manually

**Before deploying**, test that jobs can run:

#### Test via direct endpoint call:

```bash
# Test the cron endpoint (simulates GitHub Actions trigger)
curl -X POST https://yourapp.com/cron/run \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected response:
# { "success": true, "message": "Jobs completed", "timestamp": "2026-03-28T11:30:00Z" }
```

#### Test inline cron manually:

```javascript
// In backend/src/test-scheduler.js
const { runAllJobs } = require('./services/schedulerService');

(async () => {
  console.log('Running cron jobs manually...');
  await runAllJobs();
  console.log('Done!');
  process.exit(0);
})();
```

Then run:

```bash
cd backend
node src/test-scheduler.js
```

Expected output:

```
🕗 Running scheduled jobs...
Subscription expiry check complete. Expired: 0
Sent 0 expiry reminder emails
🔄 Starting auto-renewal job...
Found 0 subscriptions eligible for auto-renewal
✅ Auto-renewal job complete. Success: 0, Failures: 0
Leaderboard refreshed
✅ Scheduled jobs complete
```

---

### Step 5: Option A — Enable GitHub Actions (Production)

**File**: `.github/workflows/cron.yml`

Create this file in your repository:

```yaml
name: Scheduled Cron Jobs
on:
  schedule:
    # 8:00 AM WAT (UTC+1) = 7:00 AM UTC
    - cron: '0 7 * * *'
  workflow_dispatch:  # Allow manual trigger

jobs:
  run-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cron Jobs
        run: |
          curl -X POST https://${{ secrets.API_DOMAIN }}/cron/run \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
        env:
          SECRETS_API_DOMAIN: ${{ secrets.API_DOMAIN }}
          SECRETS_CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

**Add GitHub Secrets:**

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `API_DOMAIN`: Your backend domain (e.g., `api.yourapp.com`)
   - `CRON_SECRET`: The token you generated in Step 2

3. Commit the workflow file:

```bash
git add .github/workflows/cron.yml
git commit -m "Add scheduled cron job workflow"
git push
```

**Verify GitHub Actions:**

1. Go to repo → Actions tab
2. Look for the "Scheduled Cron Jobs" workflow
3. It should show as enabled and scheduled

---

### Step 5: Option B — Use an External Cron Service (Alternative)

If you don't use GitHub Actions, you can use a free service like **EasyCron.com**, **UptimeRobot**, or **AWS EventBridge**:

**Example with EasyCron:**

1. Visit [EasyCron.com](https://www.easycron.com/)
2. Create free account
3. Click "Add a cron job"
4. Set URL: `https://yourapp.com/cron/run`
5. Set request headers:
   ```
   Authorization: Bearer YOUR_CRON_SECRET
   Content-Type: application/json
   ```
6. Set schedule: `0 8 * * *` (8 AM daily in UTC, adjust for your timezone)
7. Save and test

---

## Monitoring & Debugging

### Check Renewal Attempts

Query the renewal tracking table to see what happened:

```sql
-- See recent renewal attempts (last 30 days)
SELECT 
  id, 
  user_id, 
  plan_name, 
  status, 
  amount, 
  error_message, 
  attempted_at
FROM subscription_renewal_attempts
WHERE attempted_at >= NOW() - INTERVAL '30 days'
ORDER BY attempted_at DESC
LIMIT 50;

-- See failed attempts (admin dashboard alert)
SELECT * FROM subscription_renewal_attempts
WHERE status = 'failed'
ORDER BY attempted_at DESC;

-- See success rate for a specific user
SELECT 
  COUNT(*) as total_attempts,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM subscription_renewal_attempts
WHERE user_id = 'user-uuid-here';
```

### View Cron Logs

**In Production (Render/Railway):**
1. Go to your deployment dashboard
2. View application logs
3. Filter for: `"cron"` or `"🕗"` or `"auto-renewal"`

**Locally:**
```bash
cd backend
npm run dev
# Watch for lines starting with: 🕗, 🔄, ✅
```

### Troubleshooting Common Issues

| Issue | Solution |
|-------|----------|
| "Jobs complete, but no auto-renewals" | ✅ Normal if no subscriptions are expiring. Query: `SELECT * FROM users WHERE auto_renew=true AND subscription_expires_at <= NOW()` |
| "Paystack Error: Invalid API key" | Check `PAYSTACK_SECRET_KEY` is set in production `.env` |
| "Table doesn't exist" error | Run migration 020. Verify in Supabase: `SELECT 1 FROM subscription_renewal_attempts LIMIT 1;` |
| "Cron never runs" | If using inline cron: set `RUN_CRON_INLINE=true` in `.env`. If using GitHub Actions: verify workflow file is committed and accepted. |
| "Failed to initialize Paystack transaction" | Verify `PAYSTACK_SECRET_KEY` is active and not in test mode |

---

## How Auto-Renewal Works

### Flow Diagram

```
[Cron job triggers daily 8 AM]
          ↓
[Query users: auto_renew=true AND subscription_expires_at <= NOW()]
          ↓
[FOR each user:]
  1. Get plan price (monthly or annual)
  2. Call Paystack to initialize transaction
  3. Log attempt to subscription_renewal_attempts
  4. If success: awaiting user payment on redirect link
  5. If failure: log error, user receives reminder to renew manually
          ↓
[Paystack webhook processes payment → activates subscription]
```

### What Gets Logged

Each renewal attempt creates a record in `subscription_renewal_attempts`:

```json
{
  "id": 42,
  "user_id": "user-uuid",
  "plan_name": "pro",
  "billing_cycle": "monthly",
  "amount": 5000.00,
  "paystack_reference": "txn_1abc2def3ghi4jkl",
  "status": "initiated",           // pending → completed/failed
  "error_message": null,
  "attempted_at": "2026-03-28T08:00:15Z",
  "verified_at": null,             // set when webhook confirms
  "created_at": "2026-03-28T08:00:15Z"
}
```

### User Experience

1. **User enables auto-renew** in Settings → Subscription tab
2. **Subscription expires**
3. **8 AM WAT cron job runs**
4. **System initiates Paystack payment** (generates payment link)
5. **User receives email**: "Your subscription is being renewed — complete payment here" (or payment succeeds automatically if card is saved)
6. **User completes payment** (if needed)
7. **Paystack webhook confirms** → subscription is reactivated for another period
8. **If payment fails**: User receives reminder email with renewal link

---

## Safety & Non-Breaking Changes

### ✅ No Breaking Changes

This implementation:
- ✅ Only affects users with `auto_renew = true` (opt-in feature)
- ✅ Uses existing Paystack integration (same flow as manual renewal)
- ✅ Creates new table (doesn't modify existing schema)
- ✅ Runs independently (if it fails, other jobs continue)
- ✅ Non-blocking (logs attempt, doesn't modify user records immediately)
- ✅ Manual renewal still works 100%
- ✅ Can be disabled by setting `RUN_CRON_INLINE=false` or removing GitHub Actions workflow

### Rollback Plan

If issues arise:

**Immediately disable auto-renewals:**

```env
# backend/.env
RUN_CRON_INLINE=false    # Disable inline cron

# If using GitHub Actions: delete .github/workflows/cron.yml
# OR disable the workflow in GitHub Actions dashboard
```

**Revert code:**

```bash
git revert [commit-sha]   # Revert to before auto-renewal changes
```

---

## Verification Checklist

Use this checklist before deploying to production:

- [ ] Migration 020 applied to production database
- [ ] `PAYSTACK_SECRET_KEY` is set in production `.env`
- [ ] `FRONTEND_URL` is set correctly for email links
- [ ] `CRON_SECRET` is strong (32+ random characters)
- [ ] GitHub Actions workflow is committed and enabled (if using GitHub Actions)
- [ ] OR `RUN_CRON_INLINE=true` set in `.env` (if using inline cron)
- [ ] Manual test successful: `curl -X POST https://yourapp.com/cron/run ...`
- [ ] At least one user has `auto_renew = true` in test database for verification
- [ ] Error logs are being collected (check logger config)
- [ ] Admin has access to query `subscription_renewal_attempts` table for debugging
- [ ] Renewal emails are configured in `emailService.js` (optional but recommended)

---

## Additional Notes

### Performance Considerations

- If you have 10,000s of eligible users, job may take 2-5 minutes
- Paystack API calls are sequential (one per user) — no parallelization to avoid rate limits
- Job is idempotent (safe to run multiple times; won't duplicate charges)
- Uses connection pooling from Supabase client

### Future Enhancements

- Save Paystack `authorization` object to allow instant charges without redirect
- Batch Paystack requests for faster processing
- Add admin dashboard widget showing renewal stats and failure rates
- Implement exponential backoff for failed renewals (retry after 1, 3, 7 days)
- Add webhook listener to `subscription.disable` from Paystack

### Support

If you encounter issues:

1. **Check logs** in backend (filter for: `auto-renewal`, `🔄`, `renewal`)
2. **Verify database migration**: `SELECT COUNT(*) FROM subscription_renewal_attempts;`
3. **Test manually**: `npm run test:cron` in backend
4. **Check Paystack**: Log into Paystack dashboard → Transactions to see if calls are going through

---

**Last Updated**: 2026-03-28 | **Status**: Ready for Production
