const mixRatios = {
  '1:1:2':   { cement: 1, sand: 1, aggregate: 2, total: 4 },
  '1:1.5:3': { cement: 1, sand: 1.5, aggregate: 3, total: 5.5 },
  '1:2:4':   { cement: 1, sand: 2, aggregate: 4, total: 7 },
  '1:3:6':   { cement: 1, sand: 3, aggregate: 6, total: 10 }
};

class ConcreteService {
  static calculate({ elements = [], mix_ratio = '1:2:4', wastage_percent = 5 }) {
    const ratio = mixRatios[mix_ratio] || mixRatios['1:2:4'];
    let totalVolume = 0;
    const results = [];

    elements.forEach(el => {
      let vol = 0;
      if (el.type === 'slab')         vol = el.length * el.width * el.thickness;
      else if (el.type === 'column')  vol = el.width * el.depth * el.height * (el.count || 1);
      else if (el.type === 'beam')    vol = el.width * el.depth * el.length * (el.count || 1);
      else if (el.type === 'footing') vol = el.length * el.width * el.depth * (el.count || 1);

      totalVolume += vol;
      results.push({ ...el, volume_m3: +vol.toFixed(4) });
    });

    const withWastage = totalVolume * (1 + wastage_percent / 100);
    const dryVolume = withWastage * 1.54;

    const cementParts = ratio.cement / ratio.total;
    const sandParts = ratio.sand / ratio.total;
    const aggParts = ratio.aggregate / ratio.total;

    const cementBags = Math.ceil((dryVolume * cementParts) / 0.035);
    const sandM3     = +(dryVolume * sandParts).toFixed(3);
    const aggM3      = +(dryVolume * aggParts).toFixed(3);

    return {
      elements: results,
      summary: {
        net_volume_m3: +totalVolume.toFixed(4),
        with_wastage_m3: +withWastage.toFixed(4),
        dry_volume_m3: +dryVolume.toFixed(4),
        mix_ratio,
        wastage_percent,
        materials: {
          cement_bags_50kg: cementBags,
          sharp_sand_m3: sandM3,
          granite_aggregate_m3: aggM3
        }
      }
    };
  }
}

module.exports = ConcreteService;
