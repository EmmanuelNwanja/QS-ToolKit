# Skill: qs-math-validation

Automated mathematical and standards validation for QSToolkit.

## BOQ Math Gate

### Invariant Checks
1. `quantity > 0` for all items with non-zero amount
2. `rate >= 0` for all items
3. `amount == quantity * rate` within ₦0.01 tolerance
4. `subtotal == sum(item.amount)` within ₦0.01
5. `total == subtotal + vat + levy` within ₦0.01
6. `vat == subtotal * vat_rate` (typically 0.075)
7. No duplicate item numbers within a section

### Cross-Document Consistency
1. Invoice subtotal + VAT + levy = total
2. BOQ revision additions + omissions net to change amount
3. Forecast predicted value ≥ current BOQ subtotal

## Calculator Standards Gate

### Concrete Calculator
- Dry volume * 1.54 = wet volume
- Cement bags = wet_volume * 1.54 / 0.0347
- Result within ±1 bag of expected

### Blockwork Calculator
- Blocks = area * blocks_per_m2 * 1.05
- 9-inch: 10/m², 6-inch: 12/m², 5-inch: 14/m²
- Result within ±5 blocks of expected

### Paint Calculator
- Litres = area / coverage * 1.1
- Emulsion: 10 m²/litre
- Result within ±0.5L of expected

### Plastering Calculator
- Volume = area * thickness_m * 1.33
- Cement bags = volume * 1.54 / 0.0347
- Result within ±1 bag of expected

### Steel/Reinforcement Calculator
- Weight = length_m * kg_per_m * 1.05
- Standard kg/m: 8mm=0.395, 10mm=0.617, 12mm=0.888, 16mm=1.579, 20mm=2.466, 25mm=3.854, 32mm=6.313

## Rate Reasonableness Gate

Flag rates outside typical Nigerian ranges:
- Cement: ₦4,000–₦8,000/bag
- 9-inch blocks: ₦250–₦450/block
- Concrete (C25 site-mixed): ₦35,000–₦55,000/m³
- Plastering: ₦1,500–₦3,000/m²
- Emulsion paint: ₦800–₦1,500/m²
- Reinforcement steel: ₦350,000–₦550,000/tonne

## Error Reporting

When validation fails, report:
- Type of error (math, standard, rate, consistency)
- Affected document/section/item
- Expected vs actual value
- Suggested correction
