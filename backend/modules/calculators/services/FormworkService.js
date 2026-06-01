class FormworkService {
  static calculate({ slabs = [], beams = [], columns = [], lintels = [], staircase = null, wastage_percent = 5 }) {
    const results = {};

    // Slabs (soffit)
    let slabSoffitTotal = 0;
    const slabResults = slabs.map(s => {
      const grossArea = (s.length_mm / 1000) * (s.width_mm / 1000);
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

    // Beams (sides + soffit)
    let beamTotal = 0;
    const beamResults = beams.map(b => {
      const L = b.length_mm / 1000;
      const W = b.width_mm / 1000;
      const D = b.depth_mm / 1000;
      const qty = b.quantity || 1;
      const sidesArea = 2 * D * L;
      const soffitArea = W * L;
      const totalArea = +((sidesArea + soffitArea) * qty).toFixed(4);
      beamTotal += totalArea;
      return { name: b.name, quantity: qty, length_m: L, sides_m2: +(sidesArea * qty).toFixed(3), soffit_m2: +(soffitArea * qty).toFixed(3), total_m2: totalArea };
    });
    results.beams = {
      items: beamResults,
      total_m2: +beamTotal.toFixed(3),
      with_wastage_m2: +(beamTotal * (1 + wastage_percent / 100)).toFixed(3),
      description: 'Sawn formwork to sides and soffit of beams'
    };

    // Columns (4 vertical faces)
    let colTotal = 0;
    const colResults = columns.map(c => {
      const W = c.width_mm / 1000;
      const D = c.depth_mm / 1000;
      const H = c.height_mm / 1000;
      const qty = c.quantity || 1;
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

    // Lintels
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

    // Staircase
    let staircaseResult = null;
    if (staircase) {
      const { waist_length_m, width_m, no_risers, riser_h_mm = 150, tread_d_mm = 270, landing_l_m = 1.2, landing_w_m = 2.2 } = staircase;
      const waistsoffit = +(waist_length_m * width_m).toFixed(3);
      const riserFaces = +((no_risers * (riser_h_mm / 1000)) * width_m).toFixed(3);
      const stringerSides = +(2 * waist_length_m * (riser_h_mm / 1000 + 0.15)).toFixed(3);
      const landingSoffit = +(landing_l_m * landing_w_m).toFixed(3);
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

    const grandTotal = slabSoffitTotal + beamTotal + colTotal + lintelTotal +
      (staircaseResult ? staircaseResult.total_m2 : 0);

    return {
      results,
      summary: {
        slab_soffit_m2: +slabSoffitTotal.toFixed(3),
        beams_m2: +beamTotal.toFixed(3),
        columns_m2: +colTotal.toFixed(3),
        lintels_m2: +lintelTotal.toFixed(3),
        staircase_m2: +(staircaseResult ? staircaseResult.total_m2 : 0).toFixed(3),
        grand_total_m2: +grandTotal.toFixed(3),
        grand_total_with_wastage_m2: +(grandTotal * (1 + wastage_percent / 100)).toFixed(3)
      },
      grand_total_m2: +grandTotal.toFixed(3),
      grand_total_with_wastage_m2: +(grandTotal * (1 + wastage_percent / 100)).toFixed(3),
      wastage_percent
    };
  }
}

module.exports = FormworkService;
