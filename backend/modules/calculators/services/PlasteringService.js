class PlasteringService {
  static calculate({ surfaces = [], thickness_mm = 15, mortar_ratio = '1:4', wastage_percent = 10 }) {
    let totalArea = 0;
    const surfaceResults = surfaces.map(s => {
      const grossArea = s.length * s.height;
      const openingsArea = (s.openings || []).reduce((sum, opening) => sum + (opening.width * opening.height), 0);
      const netArea = Math.max(grossArea - openingsArea, 0);
      totalArea += netArea;
      return {
        ...s,
        gross_area_m2: +grossArea.toFixed(3),
        openings_deduction_m2: +openingsArea.toFixed(3),
        net_area_m2: +netArea.toFixed(3)
      };
    });

    const volume = (totalArea * (thickness_mm / 1000)) * (1 + wastage_percent / 100);
    const dryVolume = volume * 1.3;
    const parts = mortar_ratio === '1:3' ? { c: 1, s: 3, t: 4 } : { c: 1, s: 4, t: 5 };
    const cementBags = Math.ceil((dryVolume * parts.c / parts.t) / 0.035);
    const sandM3 = +(dryVolume * parts.s / parts.t).toFixed(3);

    return {
      surfaces: surfaceResults,
      summary: {
        total_surface_area_m2: +totalArea.toFixed(3),
        thickness_mm,
        mortar_ratio,
        wet_volume_m3: +volume.toFixed(4),
        materials: { cement_bags_50kg: cementBags, sharp_sand_m3: sandM3 }
      }
    };
  }
}

module.exports = PlasteringService;
