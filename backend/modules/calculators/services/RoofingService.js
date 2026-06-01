class RoofingService {
  static calculate({ roof_type = 'gable', length, width, pitch_degrees = 25, sheet_length_m = 3.6, sheet_width_m = 0.9, wastage_percent = 10, include_accessories = true }) {
    const pitchFactor = 1 / Math.cos((pitch_degrees * Math.PI) / 180);
    const planArea = length * width;
    let roofArea;

    if (roof_type === 'gable') roofArea = planArea * pitchFactor;
    else if (roof_type === 'hip') roofArea = planArea * pitchFactor * 1.05;
    else roofArea = planArea;

    const effectiveCoverage = sheet_length_m * sheet_width_m;
    const sheetsNeeded = Math.ceil((roofArea / effectiveCoverage) * (1 + wastage_percent / 100));

    const purlinSpacing = 0.9;
    const rafterLength = (width / 2) / Math.cos((pitch_degrees * Math.PI) / 180);
    const purlinsPerRafter = Math.ceil(rafterLength / purlinSpacing) + 1;
    const numberOfRafters = Math.ceil(length / 0.9) + 1;
    const totalPurlins = purlinsPerRafter * (roof_type === 'gable' ? 2 : 4);

    return {
      summary: {
        plan_area_m2: +planArea.toFixed(3),
        actual_roof_area_m2: +roofArea.toFixed(3),
        roof_type,
        pitch_degrees,
        sheets: {
          size: `${sheet_length_m}m x ${sheet_width_m}m (Longspan)`,
          quantity_needed: sheetsNeeded
        },
        accessories: include_accessories ? {
          purlins_estimate: totalPurlins,
          ridging_pieces: Math.ceil(length / sheet_length_m) + 1,
          flashings_m: Math.ceil(length * 2)
        } : null
      }
    };
  }
}

module.exports = RoofingService;
