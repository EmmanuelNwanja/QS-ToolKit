# QSToolkit V1.10 — AI-Native QS Platform Roadmap

## Executive Summary

V1.10 transforms QSToolkit from a calculator-and-forms platform into an **AI-native Quantity Surveying assistant**. Every feature is designed to either save time, reduce error, or create competitive advantage — all on a **₦0 infrastructure budget**.

---

## Strategic Pillars

| Pillar | Feature | $0 Budget Enabler |
|--------|---------|-------------------|
| **Auto-BOQ** | Upload architectural drawings → draft BOQ in seconds | Google Gemini 2.0 Flash (1,500 req/day free) |
| **Cost Forecasting** | Predict overruns before they happen | Time-series on Supabase + Gemini for narrative |
| **Variance Detection** | Diff BOQ revisions instantly | Local diff algorithms + structured DB comparison |
| **Natural Language** | Ask questions, get answers, no manuals | Gemini Flash + Jina AI embeddings RAG (free tier) |
| **Smart Rates** | AI-suggested rates from your historical BOQs | Local statistical analysis on user's own data |
| **Document Integrity** | Tamper-evident BOQ/Invoice certification | SHA-256 hash chain stored in Supabase |
| **Admin Intelligence** | NL queries against platform analytics | Gemini + structured query generation |

---

## Architecture Decisions

### Why Not Just Copy SolNuv?
Solnuv is a generalist AI wrapper. QSToolkit V1.10 is a **domain-specific AI** — every model prompt, every RAG document, every algorithm is calibrated for Nigerian construction standards (SMM7, NRM2, sandcrete blocks, BS 4449 steel, laterite bulking factors). The AI doesn't just answer questions; it thinks like a Nigerian QS.

### AI Provider Strategy (Free Tier Only)
1. **Primary**: Google Gemini 2.0 Flash via `generativelanguage.googleapis.com`
   - 1,500 requests/day free
   - Multimodal (vision + text) — perfect for drawing analysis
   - 1 million token context window
2. **Embeddings**: Jina AI (`api.jina.ai`) — 1M tokens/day free
3. **Fallback**: OpenRouter free-tier models for redundancy
4. **Local**: Statistical algorithms for forecasting/variance (zero API cost)

### Blockchain Strategy (Tamper-Evident, Not Crypto)
Instead of costly on-chain transactions, V1.10 implements a **"Blockchain-lite"** audit trail:
- Every BOQ/Invoice finalization generates a SHA-256 hash of its canonical JSON
- Hash is stored in `document_hashes` table with timestamp and previous hash reference
- Creates a tamper-evident chain without gas fees
- Users can download a "Certificate of Integrity" PDF

---

## Implementation Phases

### Phase 1: Foundation (Database + Backend AI Service)
- [ ] Migration: `ai_conversations`, `document_hashes`, `boq_revisions`, `rate_suggestions`
- [ ] Backend: `aiService.js` — unified interface to Gemini, Jina, local algorithms
- [ ] Backend: `integrityService.js` — SHA-256 hash chain logic
- [ ] Backend: `forecastingService.js` — time-series cost prediction

### Phase 2: Core AI Features (Backend APIs)
- [ ] POST `/ai/chat` — Natural language QS assistant with RAG
- [ ] POST `/ai/drawings/analyze` — Vision-based drawing → BOQ extraction
- [ ] POST `/ai/rates/suggest` — Historical rate analysis
- [ ] POST `/boq/:id/variance` — Compare two BOQ versions
- [ ] GET `/projects/:id/forecast` — Cost overrun prediction
- [ ] POST `/documents/:id/certify` — Generate integrity hash
- [ ] GET `/documents/:id/verify` — Verify document integrity

### Phase 3: Frontend Experience
- [ ] `AiChatWidget.jsx` — Floating chat on dashboard, BOQ, project pages
- [ ] `DrawingUploader.jsx` — Upload drawings → Auto-BOQ flow
- [ ] `VariancePanel.jsx` — Side-by-side BOQ revision diff
- [ ] `ForecastCard.jsx` — Project cost forecast visualization
- [ ] `IntegrityBadge.jsx` — Blockchain-style verification UI
- [ ] Update landing page: "Coming Soon" → "Powered by QS AI"

### Phase 4: Admin Intelligence
- [ ] Admin AI command bar: "Show me churned users last month"
- [ ] AI-generated weekly platform summary
- [ ] Anomaly detection on billing/revenue

---

## Unique Value Proposition (Strengthened)

| Before V1.10 | After V1.10 |
|-------------|-------------|
| "BOQs in minutes" (manual input) | **"BOQs from drawings in seconds"** (AI extraction) |
| Static calculators | **Predictive cost intelligence** |
| Basic PDF export | **Tamper-evident certified documents** |
| User searches help docs | **Conversational QS expert on tap** |
| Rates from memory | **AI-suggested rates from your history** |

---

## Investor Narrative

> "QSToolkit V1.10 is the first AI-native Quantity Surveying platform in Africa. While competitors sell software licenses, we deliver an AI colleague that reads drawings, predicts costs, and certifies documents. All built on a zero-infrastructure-cost architecture that scales.
>
> Our moat is not the AI models (commoditized) — it's the **Nigerian construction domain calibration** embedded in every prompt, every RAG document, and every algorithm. A generic AI cannot tell you that laterite bulks at 1.35x or that 9-inch sandcrete blocks cover 10 per m². QSToolkit's AI can."

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Free AI tier limits exceeded | Graceful degradation: queue + notify. Rate limiting per user. |
| AI hallucination on quantities | Always flag AI-generated BOQ items as "draft — verify before finalization" |
| Data privacy concerns | All AI calls use anonymized prompts. No client data trains external models. |
| Breaks existing functionality | Feature flags + gradual rollout. Old BOQ flow remains untouched. |

---

## Success Metrics

- Auto-BOQ adoption: 30% of new BOQs created via AI within 60 days
- Chat engagement: 50% of active users interact with QS AI weekly
- Document certification: 80% of finalized BOQs carry integrity hash
- Forecast accuracy: Within 15% of actual final cost on tracked projects
