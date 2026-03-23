const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');

// ================================================================
//  NEW QS Calculators — Filling the gaps identified from
//  Miracle's 6-bedroom duplex taking-off sheets
//  Nigerian construction standards throughout
// ================================================================

// ── CALCULATOR 1: Carpentry & Roof Timbers ────────────────────────
// Covers: wall plates, tie beams, king posts, rafters (Pythagoras),
//         purlins (average length method), fascia boards
exports.carpentry = async (req, res, next) => {
  try {
    const {
      building_length_mm,      // overall building length
      building_width_mm,       // overall building width
      pitch_degrees = 25,      // roof pitch angle
      eaves_projection_mm = 900, // overhang beyond wall
      roof_type = 'hipped',    // hipped | gabled
      sections = [],           // array of roof sections with their dims
      wall_plate_size  = '75x100',   // mm
      tie_beam_size    = '75x150',   // mm
      king_post_size   = '100x100',  // mm
      rafter_size      = '50x150',   // mm
      purlin_size      = '50x75',    // mm
      fascia_size      = '25x300',   // mm
      timber_grade     = 'structural_hardwood',
      wastage_percent  = 10
    } = req.body;

    const L = building_length_mm / 1000;  // convert to metres
    const W = building_width_mm / 1000;
    const pitchRad = (pitch_degrees * Math.PI) / 180;
    const halfSpan = W / 2;
    // Height of king post at ridge = halfSpan * tan(pitch)
    const ridgeHeight = +(halfSpan * Math.tan(pitchRad)).toFixed(3);

    // ── Wall Plate ──────────────────────────────────────────────
    // Runs along top of all external walls — perimeter of building
    const wallPlatePerimeter = 2 * (L + W);
    const wallPlateWithWastage = +(wallPlatePerimeter * (1 + wastage_percent / 100)).toFixed(3);
    // At 6m per length: number of pieces
    const wallPlatePieces = Math.ceil(wallPlateWithWastage / 6);

    // ── Tie Beams ───────────────────────────────────────────────
    // Horizontal member at wall plate level across the span
    // Spacing typically 1200mm c/c
    const tieBeanSpacing = 1.2;
    const noTieBeams = Math.ceil(L / tieBeanSpacing) + 1;
    const tieBalmLength = W + (2 * eaves_projection_mm / 1000);  // width + both eaves
    const tieBmeTotal = +(noTieBeams * tieBalmLength * (1 + wastage_percent / 100)).toFixed(3);

    // ── King Posts ───────────────────────────────────────────────
    // One per tie beam node on ridge line
    const noKingPosts = noTieBeams;
    const kpHeight = ridgeHeight + 0.30;  // + 300mm seating
    const kpTotal = +(noKingPosts * kpHeight * (1 + wastage_percent / 100)).toFixed(3);

    // ── Rafters ─────────────────────────────────────────────────
    // Length by Pythagoras: rafter² = height² + half-span²
    // Plus eaves projection
    const rafterSlant = Math.sqrt(Math.pow(ridgeHeight, 2) + Math.pow(halfSpan, 2));
    const rafterWithEaves = rafterSlant + (eaves_projection_mm / 1000);
    const rafterLength = +rafterWithEaves.toFixed(3);

    // Rafters at 600mm c/c along building length (both sides)
    const noRafterSpaces = Math.ceil(L / 0.6) + 1;
    const noRafters = noRafterSpaces * 2;  // both sides
    const rafterTotal = +(noRafters * rafterLength * (1 + wastage_percent / 100)).toFixed(3);

    // ── Purlins ──────────────────────────────────────────────────
    // Horizontal members running the length of building, supporting rafters
    // Spacing 900mm c/c up the rafter slope
    const purlinSpacing = 0.9;
    const noPurlinRows = Math.ceil(rafterSlant / purlinSpacing) + 1;
    // Each purlin row runs full building length (both sides of ridge)
    const purlinLengthPerRow = L + (2 * eaves_projection_mm / 1000);
    const purlinTotalRaw = noPurlinRows * purlinLengthPerRow * 2;  // both sides
    const purlinTotal = +(purlinTotalRaw * (1 + wastage_percent / 100)).toFixed(3);

    // ── Fascia Board ─────────────────────────────────────────────
    // Runs along eaves edge — perimeter of eaves
    let fasciaPerimeter;
    if (roof_type === 'hipped') {
      // All 4 sides have eaves fascia
      fasciaPerimeter = 2 * ((L + 2 * eaves_projection_mm / 1000) + (W + 2 * eaves_projection_mm / 1000));
    } else {
      // Gabled: only 2 long sides have eaves fascia
      fasciaPerimeter = 2 * (L + 2 * eaves_projection_mm / 1000);
    }
    const fasciaTotal = +(fasciaPerimeter * (1 + wastage_percent / 100)).toFixed(3);

    // ── Section-by-section results (if provided) ─────────────────
    const sectionResults = sections.map(sec => {
      const sh = sec.halfSpan_mm / 1000;
      const sl = sec.length_mm / 1000;
      const slantLength = +Math.sqrt(Math.pow(ridgeHeight, 2) + Math.pow(sh, 2)).toFixed(3);
      const withEaves = +(slantLength + eaves_projection_mm / 1000).toFixed(3);
      const avgLength = +((withEaves + 0) / 2).toFixed(3); // ridge end tapers to 0 for hipped
      return {
        section: sec.name,
        half_span_m: sh,
        rafter_slant_m: slantLength,
        rafter_with_eaves_m: withEaves,
        average_rafter_m: avgLength,
        no_rafters: Math.ceil(sl / 0.6) + 1
      };
    });

    await logUsage(req.user.id, 'carpentry');

    return res.json(success('Carpentry & Timber calculation complete', {
      inputs: { building_length_mm, building_width_mm, pitch_degrees, eaves_projection_mm, roof_type },
      derived: {
        ridge_height_m: ridgeHeight,
        rafter_slant_m: +rafterSlant.toFixed(3),
        rafter_with_eaves_m: rafterLength,
        no_tie_beam_positions: noTieBeams,
        no_rafter_pairs: noRafterSpaces,
        no_purlin_rows_each_side: noPurlinRows
      },
      summary: {
        wall_plate: {
          size: wall_plate_size + 'mm',
          total_length_m: wallPlateWithWastage,
          no_6m_pieces: wallPlatePieces,
          note: 'Hardwood treated, in continuous lengths'
        },
        tie_beams: {
          size: tie_beam_size + 'mm',
          quantity: noTieBeams,
          length_each_m: +tieBalmLength.toFixed(3),
          total_length_m: tieBmeTotal
        },
        king_posts: {
          size: king_post_size + 'mm',
          quantity: noKingPosts,
          height_each_m: +kpHeight.toFixed(3),
          total_length_m: kpTotal
        },
        rafters: {
          size: rafter_size + 'mm',
          quantity: noRafters,
          length_each_m: rafterLength,
          total_length_m: rafterTotal
        },
        purlins: {
          size: purlin_size + 'mm',
          no_rows_per_side: noPurlinRows,
          total_length_m: purlinTotal,
          spacing_m: purlinSpacing
        },
        fascia_board: {
          size: fascia_size + 'mm',
          total_length_m: fasciaTotal
        }
      },
      section_details: sectionResults.length > 0 ? sectionResults : null,
      wastage_percent
    }));
  } catch (err) { next(err); }
};


// ── CALCULATOR 2: Formwork ───────────────────────────────────────
// Covers: sawn formwork to soffits & sides of slabs, beams,
//         columns, lintels, staircase elements
exports.formwork = async (req, res, next) => {
  try {
    const {
      slabs    = [],   // { name, length_mm, width_mm, beam_width_mm, no_beams_l, no_beams_w }
      beams    = [],   // { name, length_mm, width_mm, depth_mm, quantity }
      columns  = [],   // { name, width_mm, depth_mm, height_mm, quantity }
      lintels  = [],   // { name, length_mm, width_mm, depth_mm, quantity }
      staircase = null, // { waist_length_m, width_m, no_risers, riser_h_mm, tread_d_mm, landing_l_m, landing_w_m }
      wastage_percent = 5
    } = req.body;

    const results = {};

    // ── Slabs (soffit) ──────────────────────────────────────────
    let slabSoffitTotal = 0;
    const slabResults = slabs.map(s => {
      // Gross plan area less beam widths
      const grossArea = (s.length_mm / 1000) * (s.width_mm / 1000);
      // Deduct beam widths running in L and W directions
      const beamDeductL = (s.no_beams_l || 0) * ((s.beam_width_mm || 225) / 1000) * (s.width_mm / 1000);
      const beamDeductW = (s.no_beams_w || 0) * ((s.beam_width_mm || 225) / 1000) * (s.length_mm / 1000);
      const netArea = +(grossArea - beamDeductL - beamDeductW).toFixed(4);
      slabSoffitTotal += netArea;
      return { name: s.name, gross_m2: +grossArea.toFixed(3), deductions_m2: +(beamDeductL + beamDeductW).toFixed(3), net_soffit_m2: netArea };
    });
    results.slab_soffit = {
      items: slabResults,
      total_m2: +slabSoffitTotal.toFixed(3),
      with_wastage_m2: +(slabSoffitTotal * (1 + wastage_percent / 100)).toFixed(3),
      description: 'Sawn formwork to soffit of suspended floor slab'
    };

    // ── Beams (sides + soffit) ──────────────────────────────────
    // Area = 2 × side faces + soffit face, per metre length
    let beamTotal = 0;
    const beamResults = beams.map(b => {
      const L = b.length_mm / 1000;
      const W = b.width_mm / 1000;
      const D = b.depth_mm / 1000;
      const qty = b.quantity || 1;
      // Sides: 2 × depth × length; Soffit: width × length
      const sidesArea = 2 * D * L;
      const soffitArea = W * L;
      const totalArea = +(( sidesArea + soffitArea) * qty).toFixed(4);
      beamTotal += totalArea;
      return { name: b.name, quantity: qty, length_m: L, sides_m2: +(sidesArea * qty).toFixed(3), soffit_m2: +(soffitArea * qty).toFixed(3), total_m2: totalArea };
    });
    results.beams = {
      items: beamResults,
      total_m2: +beamTotal.toFixed(3),
      with_wastage_m2: +(beamTotal * (1 + wastage_percent / 100)).toFixed(3),
      description: 'Sawn formwork to sides and soffit of beams'
    };

    // ── Columns (4 vertical faces) ──────────────────────────────
    let colTotal = 0;
    const colResults = columns.map(c => {
      const W = c.width_mm / 1000;
      const D = c.depth_mm / 1000;
      const H = c.height_mm / 1000;
      const qty = c.quantity || 1;
      // Perimeter × height = 4 sides for square column
      const area = +(2 * (W + D) * H * qty).toFixed(4);
      colTotal += area;
      return { name: c.name, quantity: qty, height_m: H, perimeter_m: +(2 * (W + D)).toFixed(3), total_m2: area };
    });
    results.columns = {
      items: colResults,
      total_m2: +colTotal.toFixed(3),
      with_wastage_m2: +(colTotal * (1 + wastage_percent / 100)).toFixed(3),
      description: 'Sawn formwork to sides of isolated columns (vertical work)'
    };

    // ── Lintels ─────────────────────────────────────────────────
    let lintelTotal = 0;
    const lintelResults = lintels.map(l => {
      const L = l.length_mm / 1000;
      const W = l.width_mm / 1000;
      const D = l.depth_mm / 1000;
      const qty = l.quantity || 1;
      const area = +((2 * D * L + W * L) * qty).toFixed(4);
      lintelTotal += area;
      return { name: l.name, quantity: qty, total_m2: area };
    });
    results.lintels = {
      items: lintelResults,
      total_m2: +lintelTotal.toFixed(3),
      with_wastage_m2: +(lintelTotal * (1 + wastage_percent / 100)).toFixed(3),
      description: 'Sawn formwork to sides and soffit of attached lintels'
    };

    // ── Staircase ────────────────────────────────────────────────
    let staircaseResult = null;
    if (staircase) {
      const { waist_length_m, width_m, no_risers, riser_h_mm = 150, tread_d_mm = 270, landing_l_m = 1.2, landing_w_m = 2.2 } = staircase;

      // Sloping soffit of waist
      const waistsoffit = +(waist_length_m * width_m).toFixed(3);
      // Risers: vertical faces — no_risers × riser height × width
      const riserFaces = +((no_risers * (riser_h_mm / 1000)) * width_m).toFixed(3);
      // Stringer sides: 2 sides
      const stringerSides = +(2 * waist_length_m * (riser_h_mm / 1000 + 0.15)).toFixed(3);
      // Landing soffit
      const landingSoffit = +(landing_l_m * landing_w_m).toFixed(3);
      // Edges of landing
      const landingEdges = +(2 * (landing_l_m + landing_w_m) * 0.15).toFixed(3);

      const stairTotal = waist_length_m + riserFaces + stringerSides + landingSoffit + landingEdges;
      staircaseResult = {
        waist_soffit_m2: waistsoffit,
        riser_faces_m2: riserFaces,
        stringer_sides_m2: stringerSides,
        landing_soffit_m2: landingSoffit,
        landing_edges_m2: landingEdges,
        total_m2: +stairTotal.toFixed(3),
        with_wastage_m2: +(stairTotal * (1 + wastage_percent / 100)).toFixed(3)
      };
      results.staircase = staircaseResult;
    }

    // ── Grand total ──────────────────────────────────────────────
    const grandTotal = slabSoffitTotal + beamTotal + colTotal + lintelTotal +
      (staircaseResult ? staircaseResult.total_m2 : 0);

    await logUsage(req.user.id, 'formwork');

    return res.json(success('Formwork calculation complete', {
      results,
      grand_total_m2: +grandTotal.toFixed(3),
      grand_total_with_wastage_m2: +(grandTotal * (1 + wastage_percent / 100)).toFixed(3),
      wastage_percent
    }));
  } catch (err) { next(err); }
};


// ── CALCULATOR 3: Roof Accessories ──────────────────────────────
// Covers: ridge capping, valley gutters, metal fixing straps,
//         barge boards, verge flashing
exports.roofAccessories = async (req, res, next) => {
  try {
    const {
      building_length_mm,
      building_width_mm,
      roof_type = 'hipped',        // hipped | gabled
      no_valleys = 0,              // number of internal valley gutters
      valley_length_mm = 0,
      ridge_type = 'flashing',     // flashing | ridge_tile
      ridge_cap_width_mm = 600,
      metal_strap_spacing_mm = 1200,
      include_barge_board = false,  // only for gabled roofs
      eaves_projection_mm = 900,
      wastage_percent = 10
    } = req.body;

    const L = building_length_mm / 1000;
    const W = building_width_mm / 1000;
    const ep = eaves_projection_mm / 1000;

    const results = {};

    // ── Ridge Capping ────────────────────────────────────────────
    // For hipped roof: ridge runs between hip intersections
    // Approximate: ridge = length - width (for equal pitch)
    let ridgeLength;
    if (roof_type === 'hipped') {
      ridgeLength = Math.max(L - W, 0);
    } else {
      ridgeLength = L; // gabled: full building length
    }
    const ridgeWithWastage = +(ridgeLength * (1 + wastage_percent / 100)).toFixed(3);

    results.ridge_capping = {
      length_m: +ridgeLength.toFixed(3),
      with_wastage_m: ridgeWithWastage,
      description: `Flashing, ${ridge_cap_width_mm}mm girth ridge, horizontal`
    };

    // ── Hip Rafters (linear metres as accessory) ─────────────────
    let hipResults = null;
    if (roof_type === 'hipped') {
      // Each hip length = hypotenuse of (half_width × half_width + ridge_height × ridge_height)
      // Simplify: hip ≈ half_width / cos(45°) × pitch factor
      const halfW = W / 2;
      const pitchFactor = 1 / Math.cos(25 * Math.PI / 180);
      const hipLength = +(Math.sqrt(Math.pow(halfW, 2) + Math.pow(halfW, 2)) * pitchFactor + ep).toFixed(3);
      const noHips = 4;
      const hipTotal = +(hipLength * noHips * (1 + wastage_percent / 100)).toFixed(3);
      results.hip_length = {
        length_each_m: hipLength,
        quantity: noHips,
        total_m: hipTotal,
        description: 'Hip rafter length (including eaves)'
      };
    }

    // ── Valley Gutters ───────────────────────────────────────────
    if (no_valleys > 0 && valley_length_mm > 0) {
      const valleyL = valley_length_mm / 1000;
      const valleyTotal = +(no_valleys * valleyL * (1 + wastage_percent / 100)).toFixed(3);
      results.valley_gutters = {
        quantity: no_valleys,
        length_each_m: valleyL,
        total_m: valleyTotal,
        description: 'Flashing, 600mm valley gutter, horizontal'
      };
    }

    // ── Metal Fixing Straps ──────────────────────────────────────
    // 5mm thick metal strap bent around wall plate at top of wall
    // Along the length
    const strapsAlongL = Math.ceil((L + 2 * ep) / (metal_strap_spacing_mm / 1000)) + 1;
    // Along the width
    const strapsAlongW = Math.ceil((W + 2 * ep) / (metal_strap_spacing_mm / 1000)) + 1;
    const totalStraps = (strapsAlongL * 2) + (strapsAlongW * 2);  // both sides each direction

    results.metal_straps = {
      along_length_each_side: strapsAlongL,
      along_width_each_side: strapsAlongW,
      total_quantity: totalStraps,
      description: '5mm thick metal strap, bent and fixed around wall plate to top of wall'
    };

    // ── Barge Board (gabled only) ────────────────────────────────
    if (include_barge_board && roof_type === 'gabled') {
      const pitchRad = 25 * Math.PI / 180;
      const halfW = W / 2;
      const bargeLength = +(halfW / Math.cos(pitchRad) + ep).toFixed(3);
      const bargeTotal = +(bargeLength * 4 * (1 + wastage_percent / 100)).toFixed(3); // 2 gable ends × 2 slopes
      results.barge_board = {
        length_each_m: bargeLength,
        quantity: 4,
        total_m: bargeTotal,
        description: '25×300mm fascia/barge board to gable verge'
      };
    }

    await logUsage(req.user.id, 'roof_accessories');

    return res.json(success('Roof Accessories calculation complete', {
      results,
      wastage_percent
    }));
  } catch (err) { next(err); }
};


// ── CALCULATOR 4: Door & Window Schedule ─────────────────────────
// Produces a full count-based schedule with areas and descriptions
// Matches Nigerian standard door/window types from Miracle's project
exports.doorWindow = async (req, res, next) => {
  try {
    const {
      doors   = [],   // { ref, type, width_mm, height_mm, quantity, material, frame, note }
      windows = [],   // { ref, type, width_mm, height_mm, quantity, material, note }
      burglary_proof = []  // { ref, width_mm, height_mm, quantity, mesh_type }
    } = req.body;

    // ── Door schedule ────────────────────────────────────────────
    const doorTypes = {
      'double_leaf_steel':  'Purpose double leaf steel doors complete with steel frame, installed with all needed accessories, fitting to blockwall in CAS (1:4) mortar',
      'single_leaf_steel':  'Purpose single leaf steel doors, fixed to steel frame, installed with all accessories, fitting to blockwall in CAS (1:4) mortar',
      'single_leaf_panel':  'Purpose single leaf panel doors fixed to wooden frame, installed with all accessories, fitting to blockwall in CAS (1:4.5) mortar',
      'single_leaf_flush':  'Purpose single leaf flush doors complete with wooden frame, installed with all needed accessories, fitting to blockwall in CAS (1:4.5) mortar',
      'custom': 'Custom door type'
    };

    const windowTypes = {
      'sliding_aluminium':  'Two track–two panel cream anodized aluminium framed sliding glass windows fixed to manufacturer\'s details',
      'casement_aluminium': 'Cream anodized aluminium framed casement projected glass windows fixed to manufacturer\'s details',
      'louvre':             'Aluminium framed louvre windows, fixed to manufacturer\'s details',
      'fixed_light':        'Fixed aluminium framed glass light, fixed to manufacturer\'s details',
      'custom': 'Custom window type'
    };

    // Process doors
    let totalDoorArea = 0;
    const doorSchedule = doors.map(d => {
      const area = +((d.width_mm / 1000) * (d.height_mm / 1000) * d.quantity).toFixed(4);
      totalDoorArea += area;
      return {
        ref:         d.ref,
        type:        d.type,
        description: doorTypes[d.type] || doorTypes['custom'],
        size:        `${d.width_mm} × ${d.height_mm}mm`,
        quantity:    d.quantity,
        total_area_m2: area,
        material:    d.material || 'As specified',
        note:        d.note || ''
      };
    });

    // Process windows
    let totalWindowArea = 0;
    const windowSchedule = windows.map(w => {
      const area = +((w.width_mm / 1000) * (w.height_mm / 1000) * w.quantity).toFixed(4);
      totalWindowArea += area;
      return {
        ref:         w.ref,
        type:        w.type,
        description: windowTypes[w.type] || windowTypes['custom'],
        size:        `${w.width_mm} × ${w.height_mm}mm`,
        quantity:    w.quantity,
        total_area_m2: area,
        material:    w.material || 'Aluminium',
        note:        w.note || ''
      };
    });

    // Process burglary proofs
    let totalBpArea = 0;
    const bpSchedule = burglary_proof.map(bp => {
      const area = +((bp.width_mm / 1000) * (bp.height_mm / 1000) * bp.quantity).toFixed(4);
      totalBpArea += area;
      return {
        ref:         bp.ref,
        size:        `${bp.width_mm} × ${bp.height_mm}mm`,
        quantity:    bp.quantity,
        total_area_m2: area,
        mesh_type:   bp.mesh_type || '25×25mm hollow square pipe',
        description: '25×25mm hollow square pipe cut and joined into approved design, including painting in red oxide paint, plugging into blockwall and concrete work'
      };
    });

    // Total openings area (for blockwall deduction check)
    const totalOpeningsArea = +(totalDoorArea + totalWindowArea).toFixed(3);

    await logUsage(req.user.id, 'door_window');

    return res.json(success('Door & Window Schedule complete', {
      door_schedule: {
        items: doorSchedule,
        total_quantity: doors.reduce((s, d) => s + d.quantity, 0),
        total_area_m2: +totalDoorArea.toFixed(3)
      },
      window_schedule: {
        items: windowSchedule,
        total_quantity: windows.reduce((s, w) => s + w.quantity, 0),
        total_area_m2: +totalWindowArea.toFixed(3)
      },
      burglary_proof_schedule: {
        items: bpSchedule,
        total_quantity: burglary_proof.reduce((s, b) => s + b.quantity, 0),
        total_area_m2: +totalBpArea.toFixed(3)
      },
      summary: {
        total_door_openings: doors.reduce((s, d) => s + d.quantity, 0),
        total_window_openings: windows.reduce((s, w) => s + w.quantity, 0),
        total_opening_area_m2: totalOpeningsArea,
        note: 'Total opening area can be used as deduction from blockwall measurement'
      }
    }));
  } catch (err) { next(err); }
};


// ── CALCULATOR 5: BRC Mesh / DPM & Surface Treatments ────────────
// Covers: fabric wire mesh (BRC A142/A193/A252),
//         damp proof membrane, damp proof course,
//         surface treatment (herbicide), oversite concrete bed
exports.brcDpm = async (req, res, next) => {
  try {
    const {
      floor_areas    = [],    // { name, length_mm, width_mm } — each room/zone
      voids          = [],    // areas to deduct { name, length_mm, width_mm }
      brc_mesh_type  = 'A142',  // A142 | A193 | A252 | A393
      brc_side_lap_mm     = 100,
      brc_end_lap_mm      = 200,
      include_dpm         = true,
      dpm_laps_mm         = 150,   // side/end lap for polythene sheet
      include_dpc         = true,
      dpc_width_mm        = 225,   // matches wall thickness
      dpc_perimeter_m     = 0,     // if known; else calculated from areas
      include_herbicide   = true,
      include_oversite_concrete = false,
      oversite_thickness_mm = 150,
      oversite_mix        = '1:2:4',
      wastage_percent     = 10
    } = req.body;

    // BRC mesh unit weights (kg/m²) to BS 4483
    const brcWeights = {
      'A142': 2.22,   // Main bar 6mm @ 200c/c, cross bar 6mm @ 200c/c
      'A193': 3.02,   // 7mm @ 200c/c both ways
      'A252': 3.95,   // 8mm @ 200c/c both ways
      'A393': 6.16    // 10mm @ 200c/c both ways
    };
    const unitWeight = brcWeights[brc_mesh_type] || 2.22;

    // ── Calculate total floor area ───────────────────────────────
    let grossArea = 0;
    const areaResults = floor_areas.map(a => {
      const area = +(a.length_mm / 1000 * a.width_mm / 1000).toFixed(4);
      grossArea += area;
      return { name: a.name, area_m2: area };
    });

    let deductArea = 0;
    const voidResults = voids.map(v => {
      const area = +(v.length_mm / 1000 * v.width_mm / 1000).toFixed(4);
      deductArea += area;
      return { name: v.name, area_m2: area };
    });

    const netArea = +(grossArea - deductArea).toFixed(3);

    // ── BRC Mesh ─────────────────────────────────────────────────
    // Add laps: side lap 100mm, end lap 200mm increase area by ~5-8%
    const lapFactor = 1 + (brc_side_lap_mm + brc_end_lap_mm) / 2000;
    const brcAreaRequired = +(netArea * lapFactor * (1 + wastage_percent / 100)).toFixed(3);
    const brcWeightKg = +(brcAreaRequired * unitWeight).toFixed(3);
    const brcWeightTonne = +(brcWeightKg / 1000).toFixed(4);

    // ── DPM (Damp Proof Membrane) ────────────────────────────────
    let dpmResult = null;
    if (include_dpm) {
      const dpmLapFactor = 1 + (dpm_laps_mm / 1000);
      const dpmAreaRequired = +(netArea * dpmLapFactor * (1 + wastage_percent / 100)).toFixed(3);
      dpmResult = {
        net_floor_area_m2: netArea,
        area_with_laps_m2: dpmAreaRequired,
        description: 'Single layer polythene sheet damp proof membrane over 500mm wide, laid horizontal',
        lap: `${dpm_laps_mm}mm side and end laps`
      };
    }

    // ── DPC (Damp Proof Course) ─────────────────────────────────
    let dpcResult = null;
    if (include_dpc) {
      // DPC runs along all walls at ground level
      // Estimate perimeter from floor areas if not provided
      let dpcPerim = dpc_perimeter_m;
      if (!dpcPerim && floor_areas.length > 0) {
        // Rough estimate: perimeter ≈ 4 × √(netArea) for simple buildings
        dpcPerim = +(4 * Math.sqrt(netArea) * 2).toFixed(3);  // ×2 for internal walls
      }
      dpcResult = {
        total_length_m: +(dpcPerim * (1 + wastage_percent / 100)).toFixed(3),
        width_mm: dpc_width_mm,
        description: `${dpc_width_mm}mm wide damp proof course (polythene sheet) laid in cement mortar (1:3) at base of wall`
      };
    }

    // ── Surface Treatment (Herbicide) ────────────────────────────
    let herbicideResult = null;
    if (include_herbicide) {
      const herbicideArea = +(netArea * (1 + wastage_percent / 100)).toFixed(3);
      herbicideResult = {
        area_m2: herbicideArea,
        description: 'Apply herbicide (Deldrex "20" or other equal and approved) treatment solution to faces of foundation concrete'
      };
    }

    // ── Oversite Concrete Bed ────────────────────────────────────
    let oversiteResult = null;
    if (include_oversite_concrete) {
      const oversiteVol = +(netArea * (oversite_thickness_mm / 1000)).toFixed(4);
      const oversiteWithWastage = +(oversiteVol * (1 + wastage_percent / 100)).toFixed(4);
      const dryVol = oversiteWithWastage * 1.54;
      const mixParts = oversite_mix === '1:2:4' ? { c: 1, s: 2, a: 4, t: 7 } : { c: 1, s: 3, a: 6, t: 10 };
      const cementBags = Math.ceil((dryVol * mixParts.c / mixParts.t) / 0.035);
      const sandM3 = +(dryVol * mixParts.s / mixParts.t).toFixed(3);
      const aggM3 = +(dryVol * mixParts.a / mixParts.t).toFixed(3);
      oversiteResult = {
        floor_area_m2: netArea,
        thickness_mm: oversite_thickness_mm,
        concrete_volume_m3: oversiteWithWastage,
        mix_ratio: oversite_mix,
        materials: { cement_bags_50kg: cementBags, sand_m3: sandM3, aggregate_m3: aggM3 },
        description: `Reinforced in-situ concrete (${oversite_mix} — 20mm agg.) horizontal work ≤ 300mm thick in structures, poured on or against earth or blinded hardcore`
      };
    }

    await logUsage(req.user.id, 'brc_dpm');

    return res.json(success('BRC Mesh / DPM calculation complete', {
      floor_areas: areaResults,
      voids: voidResults.length > 0 ? voidResults : null,
      net_floor_area_m2: netArea,
      brc_mesh: {
        type: brc_mesh_type,
        unit_weight_kg_m2: unitWeight,
        area_required_m2: brcAreaRequired,
        total_weight_kg: brcWeightKg,
        total_weight_tonne: brcWeightTonne,
        description: `Fabric wire mesh, 4mm thick BRC wire mesh ${brc_mesh_type} weighing ${unitWeight}kg/m² to BS 4483, with side lap ${brc_side_lap_mm}mm and end lap ${brc_end_lap_mm}mm`
      },
      dpm: dpmResult,
      dpc: dpcResult,
      herbicide_treatment: herbicideResult,
      oversite_concrete: oversiteResult,
      wastage_percent
    }));
  } catch (err) { next(err); }
};

// ── Helper ────────────────────────────────────────────────────────
async function logUsage(userId, type) {
  await supabase.from('calculator_usage').insert({ user_id: userId, calculator_type: type });
}
