-- ============================================================
--  QSToolkit V1.10 — Nigerian Construction Knowledge Base
--  Pre-loaded RAG context for QSAI assistant
-- ============================================================

INSERT INTO knowledge_chunks (category, title, content, source, tags)
VALUES
  ('nigerian_standards', 'Sandcrete Block Coverage',
   'In Nigerian construction, the standard coverage for sandcrete blocks is: 9-inch blocks = 10 blocks per square metre. 6-inch blocks = 12 blocks per square metre. 5-inch blocks = 14 blocks per square metre. Mortar thickness of 10mm is assumed.',
   'Nigerian Building Practice',
   ARRAY['blocks', 'masonry', 'coverage', 'nigeria']),

  ('nigerian_standards', 'Concrete Dry-to-Wet Volume Factor',
   'For concrete quantity calculations in Nigeria, the dry-to-wet volume factor is 1.54. This means: Wet volume = Dry volume × 1.54. Standard cement bags are 50kg. A 50kg bag of cement = 0.0347 m³. Mix ratios commonly used: 1:2:4 (rich concrete for columns and beams), 1:3:6 (standard concrete for slabs and foundations), 1:4:8 (lean concrete for blinding).',
   'Nigerian Building Practice',
   ARRAY['concrete', 'mix ratio', 'cement', 'volume']),

  ('nigerian_standards', 'Steel Reinforcement (BS 4449)',
   'Nigerian construction follows BS 4449 for steel reinforcement bars. Standard diameters and unit weights: 6mm = 0.222 kg/m, 8mm = 0.395 kg/m, 10mm = 0.617 kg/m, 12mm = 0.888 kg/m, 16mm = 1.579 kg/m, 20mm = 2.466 kg/m, 25mm = 3.854 kg/m, 32mm = 6.313 kg/m. Typical overlap length = 40× bar diameter.',
   'BS 4449 / Nigerian Practice',
   ARRAY['steel', 'reinforcement', 'bars', 'weight']),

  ('nigerian_standards', 'Laterite and Earthwork Bulking Factors',
   'Bulking factors for common Nigerian soils: Laterite = 1.35, Clay = 1.25, Loam = 1.20, Sandy soil = 1.10. These factors are used when calculating excavation quantities and haulage volumes.',
   'Nigerian Building Practice',
   ARRAY['earthwork', 'excavation', 'bulking', 'laterite']),

  ('nigerian_standards', 'Roofing Standards',
   'Longspan aluminium roofing sheets in Nigeria typically measure 3.6 metres × 0.9 metres (0.9m effective cover). Standard gauge is 0.45mm or 0.55mm. Coverage per sheet = 3.24 m². Allow 10-15% for laps and waste on gable roofs, 15-20% on hipped roofs.',
   'Nigerian Building Practice',
   ARRAY['roofing', 'aluminium', 'longspan', 'coverage']),

  ('nigerian_standards', 'Plastering and Painting',
   'Standard plastering thickness in Nigeria = 15mm. Common mix ratio = 1:4 (cement:sand). Paint coverage for standard emulsion = 10 m² per litre per coat. Standard tin sizes: 5 litres, 4 litres, 1 litre. Two coats are standard for new plastered surfaces.',
   'Nigerian Building Practice',
   ARRAY['plastering', 'paint', 'coverage', 'finishes']),

  ('nigerian_standards', 'Floor Tiling',
   'Common floor tile sizes in Nigeria: 600mm × 600mm = 2.78 tiles per m². 400mm × 400mm = 6.25 tiles per m². 300mm × 300mm = 11.11 tiles per m². Allow 5-10% for cutting waste.',
   'Nigerian Building Practice',
   ARRAY['tiling', 'floor', 'tiles', 'coverage']),

  ('smm7', 'SMM7 General Rules',
   'SMM7 (Standard Method of Measurement 7th Edition) is the traditional UK-based method of measurement for building works. Key principles: Measured work is quantified net as fixed in position. Dimensions are stated in metres, square metres, or cubic metres. Dimensions are given in the sequence: length × width × height. Work is grouped under work sections (e.g. D Excavating and Filling, E In-situ Concrete).',
   'SMM7',
   ARRAY['smm7', 'measurement', 'standard']),

  ('nrm2', 'NRM2 General Rules',
   'NRM2 (New Rules of Measurement 2nd Edition) replaces SMM7 for building works. Key differences from SMM7: More detailed preliminaries section. Greater emphasis on risk allocation. Updated work sections. Measured work still quantified net as fixed in position.',
   'NRM2',
   ARRAY['nrm2', 'measurement', 'standard']),

  ('methodology', 'BOQ Structure',
   'A standard Bill of Quantities in Nigerian practice contains: 1) Preliminaries (site setup, supervision, temporary works), 2) Measured Work (substructure, superstructure, finishes, external works), 3) Provisional Sums (for work not fully defined), 4) Dayworks (for unforeseen additional work). Each item includes: item number, description, unit, quantity, rate, and amount.',
   'QSToolkit Best Practice',
   ARRAY['boq', 'structure', 'methodology'])
ON CONFLICT DO NOTHING;
