# Skill: qs-calculator-constants

Nigerian Quantity Surveying calculator constants, conversion factors, and material standards.

## Constants

### Blockwork
- 9-inch sandcrete blocks: **10 blocks/m²**
- 6-inch sandcrete blocks: **12 blocks/m²**
- 5-inch sandcrete blocks: **14 blocks/m²**

### Concrete
- Dry-to-wet volume factor: **1.54**
- Cement bag (50kg) yield: **0.0347 m³**
- Standard mix ratios by grade:
  - C20 (Gen purpose): 1:2:4 (cement:sand:aggregate)
  - C25 (Standard): 1:1.5:3
  - C30 (High strength): 1:1:2

### Soil
- Laterite bulking factor: **1.35**
- Clay bulking factor: **1.25**
- Loam bulking factor: **1.20**
- Sandy soil bulking factor: **1.10**

### Roofing
- Longspan aluminium sheets: **3.6m × 0.9m** per sheet
- Area per sheet: **3.24 m²**

### Finishes
- Emulsion paint coverage: **10 m²/litre**
- Floor tiles 600×600mm: **2.78 tiles/m²**
- Floor tiles 400×400mm: **6.25 tiles/m²**
- Plastering default thickness: **15mm**, mix **1:4** (cement:sand)

### Steel
- Reinforcement follows **BS 4449**
- Standard bar diameters: 8mm, 10mm, 12mm, 16mm, 20mm, 25mm, 32mm

## Validation Rules

1. Concrete volume → cement bags: `volume_m3 * 1.54 / 0.0347` (round up)
2. Blockwork → blocks: `area_m2 * blocks_per_m2 * 1.05` (5% wastage)
3. Paint → litres: `area_m2 / coverage_per_litre * 1.1` (10% wastage)
4. Tiles → count: `area_m2 * tiles_per_m2 * 1.05` (5% wastage)
5. Plaster volume: `area_m2 * thickness_m * 1.33` (1.33 accounts for mortar density)
