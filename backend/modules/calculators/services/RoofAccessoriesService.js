class RoofAccessoriesService {
  static calculate({
    building_length_mm, building_width_mm,
    roof_type = 'hipped', no_valleys = 0, valley_length_mm = 0,
    ridge_type = 'flashing', ridge_cap_width_mm = 600,
    metal_strap_spacing_mm = 1200, include_barge_board = false,
    eaves_projection_mm = 900, wastage_percent = 10
  }) {
    const L = building_length_mm / 1000;
    const W = building_width_mm / 1000;
    const ep = eaves_projection_mm / 1000;
    const results = {};

    // Ridge Capping
    let ridgeLength;
    if (roof_type === 'hipped') {
      ridgeLength = Math.max(L - W, 0);
    } else {
      ridgeLength = L;
    }
    const ridgeWithWastage = +(ridgeLength * (1 + wastage_percent / 100)).toFixed(3);
    results.ridge_capping = {
      length_m: +ridgeLength.toFixed(3),
      with_wastage_m: ridgeWithWastage,
      description: `Flashing, ${ridge_cap_width_mm}mm girth ridge, horizontal`
    };

    // Hip Rafters
    if (roof_type === 'hipped') {
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

    // Valley Gutters
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

    // Metal Fixing Straps
    const strapsAlongL = Math.ceil((L + 2 * ep) / (metal_strap_spacing_mm / 1000)) + 1;
    const strapsAlongW = Math.ceil((W + 2 * ep) / (metal_strap_spacing_mm / 1000)) + 1;
    const totalStraps = (strapsAlongL * 2) + (strapsAlongW * 2);
    results.metal_straps = {
      along_length_each_side: strapsAlongL,
      along_width_each_side: strapsAlongW,
      total_quantity: totalStraps,
      description: '5mm thick metal strap, bent and fixed around wall plate to top of wall'
    };

    // Barge Board (gabled only)
    if (include_barge_board && roof_type === 'gabled') {
      const pitchRad = 25 * Math.PI / 180;
      const halfW = W / 2;
      const bargeLength = +(halfW / Math.cos(pitchRad) + ep).toFixed(3);
      const bargeTotal = +(bargeLength * 4 * (1 + wastage_percent / 100)).toFixed(3);
      results.barge_board = {
        length_each_m: bargeLength,
        quantity: 4,
        total_m: bargeTotal,
        description: '25×300mm fascia/barge board to gable verge'
      };
    }

    return { results, wastage_percent };
  }
}

module.exports = RoofAccessoriesService;
