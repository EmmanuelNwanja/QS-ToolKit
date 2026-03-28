<!-- QUICK_START_CRON.md: Quick Reference for Cron Job Activation -->

# Quick Start: Activate Cron Jobs (5 minutes)

**TL;DR** - Follow these steps to enable auto-renewal in production.

---

## Step 1: Apply Database Migration (2 minutes)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create new query
3. Copy-paste entire contents of: `database/migrations/020_subscription_renewal_tracking.sql`
4. Click **Execute**
5. Verify success: Table appears in "Tables" sidebar

---

## Step 2: Set Environment Variables (1 minute)

Go to your deployment dashboard (**Render** / **Railway** / **Vercel**):

### Production Backend `.env`

```env
PAYSTACK_SECRET_KEY=sk_live_xxxxx                    # Must be set already
CRON_SECRET=<generate-with-command-below>
```

**Generate CRON_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: copythisvalue123...
```

Paste the output as your `CRON_SECRET` value.

---

## Step 3: Choose Activation Method (1 minute)

### Option A: GitHub Actions (Recommended)

1. Create file: `.github/workflows/cron.yml`
2. Paste this content:

```yaml
name: Scheduled Cron Jobs
on:
  schedule:
    - cron: '0 7 * * *'  # 8 AM WAT daily
  workflow_dispatch:
jobs:
  run-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Run Cron
        run: |
          curl -X POST https://${{ secrets.API_DOMAIN }}/cron/run \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

3. Go to GitHub repo → Settings → Secrets → **New repository secret**
4. Add:
   - Name: `API_DOMAIN`, Value: `api.yourapp.com`
   - Name: `CRON_SECRET`, Value: `<your-cron-secret>`
5. Commit: `git add .github && git commit -m "Add cron workflow" && git push`

### Option B: Inline Cron (Alternative)

1. Set in backend `.env`:
   ```env
   RUN_CRON_INLINE=true
   ```
2. Redeploy backend
3. Cron starts automatically on app startup

---

## Step 4: Verify (1 minute)

Test that jobs can run:

```bash
curl -X POST https://yourapp.com/cron/run \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected response:
# { "success": true, "message": "Jobs completed", "timestamp": "..." }
```

✅ **Done!** Auto-renewal is now active.

---

## Monitor

Check logs (Render/Railway dashboard):

```
Look for these messages:
✅ 🕗 Running scheduled jobs...
✅ 🔄 Starting auto-renewal job...
✅ ✅ Scheduled jobs complete
```

Query recent renewals:

```sql
SELECT * FROM subscription_renewal_attempts
ORDER BY attempted_at DESC
LIMIT 10;
```

---

## Troubleshoot

| Problem | Solution |
|---------|----------|
| Cron never runs | If GitHub Actions: verify workflow file committed. If inline: set `RUN_CRON_INLINE=true` |
| "Table doesn't exist" | Run migration 020 via Supabase SQL Editor |
| "Unauthorized" on curl test | Verify `CRON_SECRET` in command matches `.env` exactly |
| Paystack error | Check `PAYSTACK_SECRET_KEY` is set in production |

---

## Full Docs

For complete setup guide with all options and troubleshooting: **See `CRON_JOBS_SETUP.md`**

---

**Status**: 🟢 Ready to Deploy
