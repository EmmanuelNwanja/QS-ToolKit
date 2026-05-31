/**
 * CompetitiveFeatures — Micro-features to outcompete CostX, PlanSwift, Glodon.
 *
 * Each feature is a standalone method. Designed to be called by the
 * Smart Calculator frontend and/or integrated into ParametricEngine.
 *
 * Features:
 *   1. AI Suggest     → nearest modular size + cost impact
 *   2. Regional Lib   → material cost lookup by project location
 *   3. 3D Preview     → returns Three.js scene descriptor (frontend renders)
 *   4. Collaborative  → engineer-verified lock with PDF upload metadata
 *   5. Export         → full audit trail → CSV/Excel buffer
 *   6. Voice Input    → natural-language parser (span, type, standard)
 */

class CompetitiveFeatures {
  constructor(config = {}) {
    this.regionalCosts = config.regionalCosts || this._defaultRegionalCosts();
  }

  // ── 1. AI Suggest: nearest modular size + cost impact ──────────
  aiSuggest(dimensionMm, modularSizes, standard, elementType) {
    if (!modularSizes || modularSizes.length === 0) return null;
    const sorted = [...modularSizes].sort((a, b) => a - b);
    const isModular = sorted.includes(dimensionMm);

    if (isModular) {
      return { suggested: false, dimension_mm: dimensionMm, note: 'Already modular' };
    }

    let lower = sorted.filter(s => s < dimensionMm).pop() || null;
    let upper = sorted.find(s => s > dimensionMm) || null;

    // If no lower bound, use smallest modular; if no upper, use largest
    if (!lower) lower = sorted[0];
    if (!upper) upper = sorted[sorted.length - 1];

    const nearest = (dimensionMm - lower <= upper - dimensionMm) ? lower : upper;
    const diff = nearest - dimensionMm;

    // Estimate cost impact: concrete volume change per m run (for beams)
    const widthMm = dimensionMm * 0.4; // w ≈ h/2.5
    const areaDiff = Math.abs((nearest * widthMm) - (dimensionMm * widthMm)) / 1_000_000; // m² cross-section
    const costPerM3 = 85_000; // NGN — rough Nigerian estimate
    const costImpactPerM = +(areaDiff * costPerM3).toFixed(0);

    return {
      suggested: true,
      original_mm: dimensionMm,
      suggested_mm: nearest,
      delta_mm: diff,
      direction: diff > 0 ? 'increase' : 'decrease',
      modular_sizes_available: sorted,
      cost_impact_per_m_ngn: costImpactPerM,
      cost_impact_per_m_usd: +(costImpactPerM / 1500).toFixed(2),
      note: `Suggested ${nearest}mm (${diff > 0 ? '+' : ''}${diff}mm from ${dimensionMm}mm)`
    };
  }

  // ── 2. Regional Material Library ───────────────────────────────
  regionalMaterialCosts(location, materialType) {
    const country = (location || '').toLowerCase();
    const region = this._resolveRegion(country);
    const costs = this.regionalCosts[region] || this.regionalCosts.default;
    if (materialType) return costs[materialType] || null;
    return costs;
  }

  _resolveRegion(country) {
    const ng = ['nigeria', 'ghana', 'africa'];
    const uk = ['uk', 'gb', 'united kingdom', 'england', 'europe'];
    const us = ['us', 'usa', 'united states', 'america', 'canada', 'ca'];
    const ngCC = (country === 'ng');
    const ukCC = (country === 'uk');
    const usCC = (country === 'us');
    if (ng.some(s => country.includes(s)) || ngCC) return 'ng';
    if (uk.some(s => country.includes(s)) || ukCC) return 'uk';
    if (us.some(s => country.includes(s)) || usCC) return 'us';
    return 'default';
  }

  _defaultRegionalCosts() {
    return {
      ng: {
        concrete_grade_25_per_m3: 85000,
        cement_per_50kg_bag: 5200,
        rebar_per_kg: 850,
        formwork_ply_per_sheet: 8500,
        sand_per_trip: 45000,
        granite_per_trip: 95000,
        labour_concrete_per_m3: 12000,
        labour_formwork_per_m2: 3500,
        labour_rebar_per_kg: 150,
        currency: 'NGN',
        currency_symbol: '₦',
        note: 'Lagos / Abuja market rates, Q2 2026'
      },
      uk: {
        concrete_grade_25_per_m3: 145,
        cement_per_50kg_bag: 8,
        rebar_per_kg: 1.20,
        formwork_ply_per_sheet: 45,
        sand_per_trip: 550,
        granite_per_trip: 900,
        labour_concrete_per_m3: 90,
        labour_formwork_per_m2: 35,
        labour_rebar_per_kg: 1.5,
        currency: 'GBP',
        currency_symbol: '£',
        note: 'UK national average, Q2 2026'
      },
      us: {
        concrete_grade_25_per_m3: 165,
        cement_per_50kg_bag: 12,
        rebar_per_kg: 1.50,
        formwork_ply_per_sheet: 55,
        sand_per_trip: 700,
        granite_per_trip: 1100,
        labour_concrete_per_m3: 100,
        labour_formwork_per_m2: 40,
        labour_rebar_per_kg: 2.0,
        currency: 'USD',
        currency_symbol: '$',
        note: 'US national average, Q2 2026'
      },
      default: {
        concrete_grade_25_per_m3: 100,
        cement_per_50kg_bag: 6,
        rebar_per_kg: 1.0,
        formwork_ply_per_sheet: 30,
        sand_per_trip: 400,
        granite_per_trip: 600,
        labour_concrete_per_m3: 60,
        labour_formwork_per_m2: 20,
        labour_rebar_per_kg: 1.0,
        currency: 'USD',
        currency_symbol: '$',
        note: 'International baseline estimate'
      }
    };
  }

  // ── 3. 3D Preview — scene descriptor for frontend Three.js ────
  threeDPreview(elementType, derived) {
    const scene = {
      type: elementType,
      dimensions: {},
      geometry: null,
      annotations: []
    };

    switch (elementType) {
      case 'beam': {
        const L = (derived.length_m || derived.arc_length_m || 5) * 0.8;
        const D = (derived.depth_mm || 400) / 1000 * 0.8;
        const W = (derived.width_mm || 250) / 1000 * 0.8;
        scene.dimensions = { length: L, width: W, height: D };
        scene.geometry = 'BoxGeometry';
        scene.annotations = [
          { label: `L = ${(derived.length_m || derived.arc_length_m || '').toFixed(2)}m`, axis: 'x' },
          { label: `D = ${derived.depth_mm || ''}mm`, axis: 'y' },
          { label: `W = ${derived.width_mm || ''}mm`, axis: 'z' }
        ];
        break;
      }
      case 'column': {
        const H = (derived.height_m || derived.clear_height_m || 3) * 0.8;
        const W = (derived.width_mm || 300) / 1000 * 0.8;
        const D = (derived.depth_mm || 300) / 1000 * 0.8;
        scene.dimensions = { width: W, height: H, depth: D };
        scene.geometry = 'BoxGeometry';
        scene.annotations = [
          { label: `H = ${(derived.height_m || derived.clear_height_m || '').toFixed(2)}m`, axis: 'y' },
          { label: `b = ${derived.width_mm || ''}mm`, axis: 'x' },
          { label: `h = ${derived.depth_mm || ''}mm`, axis: 'z' }
        ];
        break;
      }
      case 'circular_column': {
        const D = (derived.diameter_mm || 450) / 1000 * 0.8;
        const H = (derived.height_m || 3) * 0.8;
        scene.dimensions = { radius: D / 2, height: H, segments: 24 };
        scene.geometry = 'CylinderGeometry';
        scene.annotations = [
          { label: `D = ${derived.diameter_mm || ''}mm`, axis: 'x' },
          { label: `H = ${(derived.height_m || '').toFixed(2)}m`, axis: 'y' }
        ];
        break;
      }
      case 'slab': {
        const L = (derived.length_m || 5) * 0.8;
        const W = (derived.width_m || 4) * 0.8;
        const T = (derived.thickness_mm || 150) / 1000 * 0.8;
        scene.dimensions = { width: W, height: T, depth: L };
        scene.geometry = 'BoxGeometry';
        scene.annotations = [
          { label: `ℓ = ${(derived.length_m || '').toFixed(1)}m`, axis: 'z' },
          { label: `h = ${derived.thickness_mm || ''}mm`, axis: 'y' },
          { label: `W = ${(derived.width_m || '').toFixed(1)}m`, axis: 'x' }
        ];
        break;
      }
      case 'dome_shell': {
        scene.dimensions = {
          radius: (derived.sphere_radius_m || 6) * 0.8,
          height: (derived.rise_m || 2.5) * 0.8,
          phiStart: 0, phiLength: Math.PI * 2,
          thetaStart: 0, thetaLength: Math.PI / 2
        };
        scene.geometry = 'SphereGeometry';
        scene.annotations = [
          { label: `R = ${(derived.sphere_radius_m || '').toFixed(1)}m`, axis: 'y' },
          { label: `h = ${(derived.rise_m || '').toFixed(1)}m`, axis: 'y' }
        ];
        break;
      }
      default:
        scene.geometry = 'BoxGeometry';
    }
    return scene;
  }

  // ── 4. Collaborative Override (engineer lock) ──────────────────
  createEngineeringLock({ calculation_id, engineer_name, engineer_id, pdf_url, notes, overridden_fields }) {
    return {
      calculation_id,
      locked_at: new Date().toISOString(),
      engineer_name,
      engineer_id,
      pdf_url,
      notes: notes || '',
      overridden_fields: overridden_fields || [],
      badge: 'Engineer Verified',
      status: 'locked'
    };
  }

  verifyLock(lock, userId) {
    if (lock.status !== 'locked') return { verified: false, reason: 'Not locked' };
    if (lock.engineer_id !== userId) return { verified: false, reason: 'Not the locking engineer' };
    return { verified: true, badge: lock.badge };
  }

  // ── 5. Export to CSV/Excel ──────────────────────────────────
  exportAuditToCsv(result) {
    const rows = [];
    const audit = result.audit || [];
    const derived = result.derived || {};
    const quantities = result.quantities || {};

    // Header
    rows.push(['Rule', 'Input', 'Computed Value', 'Formula Trace']);
    for (const a of audit) {
      rows.push([a.rule_name || '', String(a.input || ''), String(a.computed_value || ''), a.formula_trace || '']);
    }

    rows.push([]);
    rows.push(['Derived Dimension', 'Value']);
    for (const [k, v] of Object.entries(derived)) {
      rows.push([k, String(v)]);
    }

    rows.push([]);
    rows.push(['Quantity', 'Value', 'Unit']);
    if (quantities.concrete_volume_m3 !== undefined) rows.push(['Concrete', quantities.concrete_volume_m3, 'm³']);
    if (quantities.formwork_m2 !== undefined) rows.push(['Formwork', quantities.formwork_m2, 'm²']);
    if (quantities.reinforcement_kg !== undefined) rows.push(['Reinforcement', quantities.reinforcement_kg, 'kg']);

    return this._toCsvString(rows);
  }

  _toCsvString(rows) {
    return rows.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    ).join('\n');
  }

  // ── 6. Voice Input Parser ────────────────────────────────────
  parseVoiceInput(transcript) {
    if (!transcript || typeof transcript !== 'string') return null;
    const t = transcript.toLowerCase().trim();

    const elementTypes = {
      'beam': 'beam', 'beams': 'beam',
      'column': 'column', 'columns': 'column', 'pillar': 'column', 'pillars': 'column',
      'slab': 'slab', 'slabs': 'slab', 'decking': 'slab',
      'footing': 'footing', 'footings': 'footing', 'foundation': 'footing',
      'wall': 'wall', 'walls': 'wall', 'shear wall': 'wall',
      'circular column': 'circular_column', 'round column': 'circular_column', 'circular pillar': 'circular_column',
      'cylindrical wall': 'cylindrical_wall', 'tank wall': 'cylindrical_wall', 'silo': 'cylindrical_wall',
      'curved beam': 'curved_beam', 'arch beam': 'curved_beam', 'arc beam': 'curved_beam',
      'dome': 'dome_shell', 'shell': 'dome_shell', 'dome roof': 'dome_shell',
      'staircase': 'staircase', 'stairs': 'staircase', 'stair': 'staircase'
    };

    const standards = {
      'eurocode': 'eurocode', 'eurocode 2': 'eurocode', 'ec2': 'eurocode', 'european': 'eurocode',
      'aci': 'aci318', 'aci 318': 'aci318', 'american': 'aci318',
      'is 456': 'is456', 'is456': 'is456', 'indian': 'is456',
      'bs 8110': 'bs8110', 'bs8110': 'bs8110', 'british': 'bs8110'
    };

    const supportConditions = {
      'simply supported': 'simply_supported', 'simple': 'simply_supported',
      'continuous': 'continuous',
      'cantilever': 'cantilever',
      'one way': 'one_way', 'one-way': 'one_way',
      'two way': 'two_way', 'two-way': 'two_way',
      'flat': 'flat', 'flat slab': 'flat'
    };

    // Extract element type
    let elementType = null;
    let matchLen = 0;
    for (const [phrase, type] of Object.entries(elementTypes)) {
      if (t.includes(phrase) && phrase.length > matchLen) {
        elementType = type;
        matchLen = phrase.length;
      }
    }

    // Extract dimension (meters or millimeters)
    const dimMatch = t.match(/(\d+[.\s]*\d*)\s*(meter|metre|m|mm|millimeter|millimetre)s?/i);
    let primaryDimMm = null;
    if (dimMatch) {
      const val = parseFloat(dimMatch[1].replace(/\s/g, ''));
      const unit = dimMatch[2].toLowerCase();
      primaryDimMm = unit.startsWith('m') ? val * 1000 : val;
    }

    // Extract standard
    let standard = 'eurocode';
    for (const [phrase, code] of Object.entries(standards)) {
      if (t.includes(phrase)) { standard = code; break; }
    }

    // Extract support condition / typology
    let typology = null;
    for (const [phrase, value] of Object.entries(supportConditions)) {
      if (t.includes(phrase)) { typology = value; break; }
    }

    if (!elementType) return null;

    return {
      element_type: elementType,
      primary_dim_mm: primaryDimMm,
      standard,
      extra: typology ? { support_type: typology } : {},
      confidence: primaryDimMm ? 'high' : 'medium',
      raw: transcript
    };
  }
}

module.exports = CompetitiveFeatures;
