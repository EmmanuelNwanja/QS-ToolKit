class PaintService {
  static calculate({ surfaces = [], coats = 2, coverage_m2_per_litre = 10, include_primer = true, primer_coverage = 12 }) {
    let totalArea = 0;
    const surfaceResults = surfaces.map(s => {
      const gross = s.length * s.height;
      const deductions = (s.openings || []).reduce((a, o) => a + o.width * o.height, 0);
      const net = Math.max(gross - deductions, 0);
      totalArea += net;
      return { ...s, area_m2: +net.toFixed(3) };
    });

    const paintLitres = Math.ceil((totalArea * coats) / coverage_m2_per_litre);
    const primerLitres = include_primer ? Math.ceil(totalArea / primer_coverage) : 0;

    const tins5L = Math.floor(paintLitres / 5);
    const remaining = paintLitres % 5;
    const tins4L = Math.floor(remaining / 4);
    const tins1L = remaining % 4;

    return {
      surfaces: surfaceResults,
      summary: {
        total_area_m2: +totalArea.toFixed(3),
        coats,
        paint_litres_required: paintLitres,
        suggested_tins: { '5L_tins': tins5L, '4L_tins': tins4L, '1L_tins': tins1L },
        primer_litres: primerLitres
      }
    };
  }
}

module.exports = PaintService;
