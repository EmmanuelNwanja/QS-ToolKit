# Skill: qs-rate-intelligence

Smart rate suggestion and market intelligence for Nigerian construction.

## Approach

1. **Exact Match**: Search user's own BOQ history for identical description + unit
2. **Fuzzy Match**: Search for similar descriptions within same category
3. **Market Benchmark**: Fallback to regional market rates from knowledge base
4. **Confidence Scoring**: Weight by recency, frequency, and regional proximity

## Rate Validation Rules

Flag suggestions outside these ranges (require human confirmation):
- Cement: ₦4,000–₦8,000/bag
- 9-inch blocks: ₦250–₦450/block
- 6-inch blocks: ₦200–₦350/block
- Reinforcement steel: ₦350,000–₦550,000/tonne
- Concrete (site-mixed C25): ₦35,000–₦55,000/m³
- Plastering: ₦1,500–₦3,000/m²
- Emulsion paint: ₦800–₦1,500/m²

## Learning Signals

- **Acceptance**: User uses suggested rate without change → increase confidence
- **Override**: User changes rate → capture override amount, adjust model weights
- **Rejection**: User deletes suggestion → flag for review

## Regional Factors

| Region | Factor |
|--------|--------|
| Lagos | 1.00 (baseline) |
| Abuja | 0.95 |
| Port Harcourt | 1.05 |
| Kano | 0.85 |
| Other states | 0.90–1.00 |
