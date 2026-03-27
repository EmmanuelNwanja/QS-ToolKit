# 🏗️ QSToolkit — Nigeria's Quantity Surveying Platform

> **qstoolkit.com** · Professional QS tools for Nigerian practitioners: Calculators, BOQs, Invoices, Project Tracking, Client Feedback & Leaderboard.

---

## 📁 Project Structure

```
qstoolkit/
├── backend/         → Node.js/Express API (deploy to Render.com)
├── frontend/        → Next.js 14 web app (deploy to Vercel)
├── database/        → SQL migrations (run in Supabase)
├── .github/         → CI + daily cron workflow
├── render.yaml      → Render.com backend config
└── README.md
```

---

## 🚀 Step-by-Step Deployment Guide (Zero Cost)

### Prerequisites — Create free accounts on all 5 platforms first:

| # | Service | URL | Purpose |
|---|---------|-----|---------|
| 1 | **GitHub** | github.com | Code hosting + cron jobs |
| 2 | **Supabase** | supabase.com | PostgreSQL database |
| 3 | **Brevo** | brevo.com | Email sending (300/day free) |
| 4 | **Render** | render.com | Backend API hosting |
| 5 | **Vercel** | vercel.com | Frontend hosting |

---

### STEP 1 — Set Up Supabase Database

1. Create a new **Supabase project** at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → click **New query**
3. Copy and run each migration **in order**:
   - `database/migrations/001_initial_schema.sql`
   - `database/migrations/002_boq_invoices.sql`
   - `database/migrations/003_feedback_leaderboard.sql`
   - `database/migrations/004_lint_fixes.sql`
   - `database/migrations/005_lint_fixes_round2.sql`
   - `database/migrations/006_pricing_promos_philanthropist.sql`
   - `database/migrations/007_admin_dashboard.sql`
   - `database/migrations/008_billing_audit_system.sql`
   - `database/migrations/009_auth_verification_and_identity_controls.sql`
   - `database/migrations/010_leaderboard_count_active_projects.sql`
   - `database/migrations/011_leaderboard_privacy_and_value_fix.sql`
   - `database/migrations/012_project_milestones.sql`
   - `database/migrations/013_plan_refresh_basic_pro_enterprise.sql`
   - `database/migrations/014_leaderboard_value_parity_refresh.sql`
   - `database/migrations/015_rollout_checklist.sql`
   - `database/migrations/016_boq_invoice_monthly_limits.sql`
   - `database/migrations/017_leaderboard_aggregation_fix.sql`
4. Run plan seeds:
   - `database/seeds/001_seed_plans.sql`
4. Go to **Storage** → Create two buckets:
   - `branding` (private)
   - `exports` (private)
5. Note your **Project URL** and **API Keys** from Settings → API

---

### STEP 2 — Push Code to GitHub

```bash
cd qstoolkit
git init
git add .
git commit -m "Initial QSToolkit commit"
git remote add origin https://github.com/YOUR_USERNAME/qstoolkit.git
git push -u origin main
```

---

### STEP 3 — Deploy Backend to Render.com

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name:** `qstoolkit-api`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Add **Environment Variables** (click Add Env Var for each):

```
NODE_ENV            = production
PORT                = 5000
FRONTEND_URL        = https://qstoolkit.com
SUPABASE_URL        = https://your-project.supabase.co
SUPABASE_SERVICE_KEY= your-service-role-key
SUPABASE_ANON_KEY   = your-anon-key
JWT_SECRET          = (generate: openssl rand -base64 64)
JWT_EXPIRES_IN      = 7d
BREVO_API_KEY       = your-brevo-api-key
BREVO_SENDER_EMAIL  = noreply@qstoolkit.com
BREVO_SENDER_NAME   = QSToolkit
PAYSTACK_SECRET_KEY = sk_live_xxxxx
PAYSTACK_PUBLIC_KEY = pk_live_xxxxx
CRON_SECRET         = (generate: openssl rand -base64 32)
```

5. Click **Create Web Service** — your API will be at `https://qstoolkit-api.onrender.com`

---

### STEP 4 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
4. Add **Environment Variables**:

```
NEXT_PUBLIC_API_URL             = https://qstoolkit-api.onrender.com/api/v1
NEXT_PUBLIC_SUPABASE_URL        = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = your-anon-key
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = pk_live_xxxxx
NEXT_PUBLIC_APP_URL             = https://qstoolkit.com
```

5. Click **Deploy** — your site will be at `https://qstoolkit.vercel.app`

---

### STEP 5 — Connect Your Custom Domain (qstoolkit.com)

**In Vercel:**
1. Go to your project → Settings → Domains
2. Add `qstoolkit.com` and `www.qstoolkit.com`
3. Vercel will show you DNS records to add

**In Cloudflare:**
1. Add the DNS records Vercel provides
2. For the API: Add a CNAME record `api.qstoolkit.com` → `qstoolkit-api.onrender.com`
3. Enable **SSL/TLS Full** mode

---

### STEP 6 — Configure GitHub Actions Secrets

For the daily cron job to work, add secrets to GitHub:

1. Go to your GitHub repo → Settings → Secrets → Actions
2. Add these repository secrets:

```
CRON_SECRET                   = (same value as backend env)
NEXT_PUBLIC_SUPABASE_URL      = your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
```

---

### STEP 7 — Set Up Paystack

1. Create account at [paystack.com](https://paystack.com)
2. Get your **Live Keys** from Dashboard → Settings → API Keys
3. Add **Webhook URL** in Paystack dashboard:
   - `https://api.qstoolkit.com/api/v1/subscriptions/webhook`
4. Update your environment variables with live keys

---

### STEP 8 — Set Up Brevo Email

1. Create account at [brevo.com](https://brevo.com)
2. Go to SMTP & API → API Keys → Generate new key
3. Add to backend environment variables as `BREVO_API_KEY`
4. Verify your sender domain `qstoolkit.com` in Brevo settings

---

## 🧪 Local Development

### Backend
```bash
cd backend
cp .env.example .env
# Fill in .env values
npm install
npm run dev
# API runs at http://localhost:5000
```

### Frontend
```bash
cd frontend
cp .env.local.example .env.local
# Fill in .env.local values
npm install
npm run dev
# App runs at http://localhost:3000
```

---

## 🧮 Calculators Included

| Calculator | Nigerian Standard Used |
|------------|----------------------|
| Concrete Volume | Dry-to-wet volume factor (1.54), 50kg cement bags |
| Blockwork & Masonry | 9"/6"/5" sandcrete blocks, 10-block/m² standard |
| Plastering | 15mm thickness default, 1:4 mix |
| Paint | 10m²/litre typical emulsion, 5L/4L/1L tin breakdown |
| Roofing | Longspan aluminium sheets (3.6m×0.9m), gable/hip/flat |
| Steel Reinforcement | BS 4449, 6mm–32mm bars with unit weights |
| Earthwork / Excavation | Soil bulking factors (laterite, clay, loam, sandy) |
| Floor Tiling | 600×600mm, 400×400mm, grout calculation |

Current platform marketing uses **10+ calculators** across all QS categories.

---

## 📧 Support

- Built for Nigeria by QSToolkit
- Email: support@qstoolkit.com
- Website: qstoolkit.com

---

## 📄 Architecture

```
qstoolkit.com (Cloudflare DNS + SSL)
        │
        ├── Frontend (Vercel) ─── Next.js 14 + Tailwind
        │
        └── Backend API (Render) ─── Node.js + Express
                    │
                    ├── Supabase (PostgreSQL + Auth + Storage)
                    ├── Brevo (Email — 300/day free)
                    └── GitHub Actions (Daily cron jobs)
```

---

*Built with ₦0 infrastructure budget. 100% free tier services.*
