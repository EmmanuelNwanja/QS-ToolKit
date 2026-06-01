const bulkingFactors = { loam: 1.25, clay: 1.35, sandy: 1.15, laterite: 1.20 };

class EarthworkService {
  static calculate({
    sections = [], soil_type = 'loam', bulking_factor,
    working_space_mm = 300, working_space_mode = 'both_sides',
    excavation_method = 'mechanical', excavation_type = 'trench',
    backfill_factor = 0.6, compaction_unit = 'm3'
  }) {
    const bf = bulking_factor || bulkingFactors[soil_type] || 1.25;
    const methodFactors = { manual: 1.2, mechanical: 1.0 };
    const typeFactors = { trench: 1.0, bulk: 0.95 };
    const sideMultiplier = working_space_mode === 'single_side' ? 1 : 2;
    const allowanceM = Math.max(Number(working_space_mm) || 0, 0) / 1000;

    let totalExcavation = 0;
    let totalBackfill = 0;
    const sectionResults = sections.map(s => {
      const baseWidth = Number(s.width || 0);
      const effectiveWidth = baseWidth + (allowanceM * sideMultiplier);
      const vol = Number(s.length || 0) * effectiveWidth * Number(s.depth || 0);
      const backfill = vol * Math.max(Math.min(Number(backfill_factor), 1), 0);
      totalExcavation += vol;
      totalBackfill += backfill;
      return {
        ...s,
        base_width_m: +baseWidth.toFixed(3),
        effective_width_m: +effectiveWidth.toFixed(3),
        working_space_added_m: +(allowanceM * sideMultiplier).toFixed(3),
        excavation_in_situ_m3: +vol.toFixed(4),
        backfill_compacted_m3: +backfill.toFixed(4),
        compaction_qty: +(compaction_unit === 'm2'
          ? (Number(s.length || 0) * effectiveWidth)
          : backfill).toFixed(4)
      };
    });

    const looseVolume = totalExcavation * bf;
    const disposalLoose = looseVolume - totalBackfill;
    const methodFactor = methodFactors[excavation_method] || 1;
    const typeFactor = typeFactors[excavation_type] || 1;
    const productivityIndex = +(1 / (methodFactor * typeFactor * bf)).toFixed(3);

    return {
      sections: sectionResults,
      summary: {
        excavation_in_situ_m3: +totalExcavation.toFixed(4),
        disposal_loose_m3: +disposalLoose.toFixed(4),
        backfill_compacted_m3: +totalBackfill.toFixed(4),
        compaction_m3_or_m2: +(compaction_unit === 'm2'
          ? sectionResults.reduce((sum, section) => sum + Number(section.compaction_qty || 0), 0)
          : totalBackfill).toFixed(4),
        soil_type,
        excavation_method,
        excavation_type,
        bulking_factor: bf,
        working_space_mm: Number(working_space_mm) || 0,
        working_space_mode,
        productivity_index: productivityIndex,
        loose_volume_m3: +looseVolume.toFixed(4),
        truck_loads_5t: Math.ceil(looseVolume / 5),
        note: 'Outputs are separated for excavation, disposal, backfilling, and compaction.'
      }
    };
  }
}

module.exports = EarthworkService;
