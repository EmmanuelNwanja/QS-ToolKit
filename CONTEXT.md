# QSToolkit Domain Context

The canonical glossary and domain model for QSToolkit — Nigeria's Quantity Surveying Platform.

## Domain Model

```
User
├── Account (email, password_hash, role, subscription_tier)
├── Profile (name, profession, location, bio, phone)
├── Projects[]
│   ├── BOQ Documents[]
│   │   ├── BOQ Revisions[]
│   │   ├── Invoices[]
│   │   └── Document Hashes[] (integrity certification)
│   ├── Cost Forecasts[]
│   ├── Drawing Analysis Jobs[]
│   └── Drawing Primitive Annotations[]
├── AI Conversations[]
├── AI Usage Daily[]
├── Smart Rate Suggestions[]
├── Calculator Usage[]
└── Feedback Responses[]
```

## Canonical Glossary

### Project
A construction project managed by a QS practitioner. Contains metadata (name, location, client, status, milestones) and associated BOQs, invoices, forecasts.

### BOQ (Bill of Quantities)
A structured document listing all materials, labor, and services required for a project, with quantities, units, rates, and amounts.
- **Section**: Grouping of related items (e.g., "Substructure", "Superstructure", "Finishes")
- **Item**: A single line in the BOQ with description, unit, quantity, rate, amount
- **Rate**: Price per unit in Nigerian Naira (₦)
- **Amount**: `quantity × rate`
- **Subtotal**: Sum of all item amounts
- **VAT**: Value Added Tax (typically 7.5%)
- **Levy**: Additional statutory charge if applicable
- **Total**: `subtotal + VAT + levy`

### BOQ Revision
A versioned change to a BOQ. Tracks additions, omissions, and modifications.
- **Additions**: New items added
- **Omissions**: Items removed
- **Modifications**: Changes to existing items (quantity, rate, description)

### Invoice
A payment document generated from a BOQ, sent to a client.
- **Client**: The party being billed
- **Trace Token**: A SHA-256 hash certifying invoice integrity
- **Payment Link**: Paystack-generated payment URL

### Drawing Analysis Job
An AI-powered analysis of an architectural drawing (floor plan, elevation, section, site plan) to extract quantities for BOQ creation.

### Visual Primitive
A spatial marker (bounding box, polygon, point, line) interleaved into AI reasoning to precisely reference elements in a drawing.

### Rate Suggestion
An AI-generated market rate for a BOQ item, based on the user's historical BOQ data and Nigerian construction market conditions.

### Cost Forecast
A statistical prediction of a project's final cost, based on historical overrun patterns and current BOQ data.

### Integrity Certification
A SHA-256 hash chain stored in Supabase, providing tamper-evident proof of document state at a point in time.

### Dr. Q
The AI assistant persona. Customer-facing for QS practitioners. Admin-facing for platform analytics.

### Subscription Tier
- **Free**: Limited projects, basic calculators, no AI
- **Basic**: More projects, AI chat, basic drawing analysis
- **Pro**: Full AI suite, advanced drawing analysis, forecasts, variance
- **Enterprise**: Custom features, dedicated support

## Nigerian QS Standards

### Measurement Standards
- **SMM7**: Standard Method of Measurement (7th Edition) — British, widely used in Nigeria
- **NRM2**: New Rules of Measurement (2nd Edition) — alternative standard
- Both govern how quantities are measured and described in BOQs.

### Material Standards
- **Cement**: Dangote, BUA, Lafarge — 50kg bags. Current range: ₦4,000–₦8,000/bag
- **Sandcrete Blocks**: 9-inch (10/m²), 6-inch (12/m²), 5-inch (14/m²)
- **Steel Reinforcement**: BS 4449 / ASTM A615
- **Concrete**: Mix ratios by strength grade (C20, C25, C30, etc.)
- **Laterite**: Bulking factor 1.35
- **Clay**: Bulking factor 1.25
- **Loam**: Bulking factor 1.20
- **Sandy Soil**: Bulking factor 1.10

### Calculator Constants
- **Concrete dry-to-wet factor**: 1.54 (multiply dry volume by 1.54 to get wet volume)
- **Cement bag yield**: 0.0347 m³ per 50kg bag
- **Longspan aluminium roofing**: 3.6m × 0.9m per sheet
- **Paint coverage (emulsion)**: 10 m²/litre
- **Floor tiles 600×600mm**: 2.78 tiles/m²
- **Floor tiles 400×400mm**: 6.25 tiles/m²
- **Plastering default**: 15mm thickness, 1:4 cement-sand mix

## Regional Variations

| Region | Cement Price Range | Block Price Range | Labor Factor |
|--------|-------------------|-------------------|--------------|
| Lagos | ₦5,500–₦7,500 | ₦350–₦450 | 1.0 (baseline) |
| Abuja | ₦5,000–₦7,000 | ₦320–₦420 | 0.95 |
| Port Harcourt | ₦5,800–₦7,800 | ₦360–₦460 | 1.05 |
| Kano | ₦4,500–₦6,500 | ₦280–₦380 | 0.85 |
| Other states | ₦4,000–₦7,000 | ₦250–₦450 | 0.90–1.0 |

## Anti-Patterns (Never Do)

1. **Never** store user passwords in plain text (already handled by bcryptjs)
2. **Never** expose Supabase service role key to frontend
3. **Never** skip rate limiting on AI endpoints (cost explosion risk)
4. **Never** emit a BOQ with math errors (`quantity × rate ≠ amount`)
5. **Never** suggest rates without Nigerian market context
6. **Never** claim a drawing analysis is "100% accurate" — always include confidence
7. **Never** store payment card details (use Paystack tokenization)
8. **Never** modify a finalized document hash chain
9. **Never** allow cross-user BOQ/invoice access without explicit sharing
10. **Never** deploy AI changes without math validation gate

---

*Version: 1.0.0 | QSToolkit V1.10 Domain Model*
