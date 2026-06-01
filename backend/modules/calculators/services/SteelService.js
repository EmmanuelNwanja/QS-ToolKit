const unitWeights = {
  6: 0.222, 8: 0.395, 10: 0.617, 12: 0.888,
  16: 1.578, 20: 2.466, 25: 3.854, 32: 6.313
};

class SteelService {
  static calculate({ bars = [] }) {
    const results = bars.map(b => {
      const uw = unitWeights[b.diameter_mm] || 0;
      const weightKg = +(b.length_m * b.quantity * uw).toFixed(3);
      const weightTonne = +(weightKg / 1000).toFixed(4);
      return { ...b, unit_weight_kg_per_m: uw, total_weight_kg: weightKg, total_weight_tonne: weightTonne };
    });

    const totalKg = results.reduce((s, r) => s + r.total_weight_kg, 0);

    return {
      bars: results,
      summary: {
        total_weight_kg: +totalKg.toFixed(3),
        total_weight_tonne: +(totalKg / 1000).toFixed(4),
        note: 'Add 5–10% for laps, bends and wastage'
      }
    };
  }
}

module.exports = SteelService;
