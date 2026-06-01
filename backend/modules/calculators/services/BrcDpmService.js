const brcWeights = {
  'A142': 2.22, 'A193': 3.02, 'A252': 3.95, 'A393': 6.16
};

class BrcDpmService {
  static calculate({
    floor_areas = [], voids = [],
    brc_mesh_type = 'A142', brc_side_lap_mm = 100, brc_end_lap_mm = 200,
    include_dpm = true, dpm_laps_mm = 150,
    include_dpc = true, dpc_width_mm = 225, dpc_perimeter_m = 0,
    include_herbicide = true,
    include_oversite_concrete = false, oversite_thickness_mm = 150, oversite_mix = '1:2:4',
    wastage_percent = 10
  }) {
    const unitWeight = brcWeights[brc_mesh_type] || 2.22;

    // Floor area
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

    // BRC Mesh
    const lapFactor = 1 + (brc_side_lap_mm + brc_end_lap_mm) / 2000;
    const brcAreaRequired = +(netArea * lapFactor * (1 + wastage_percent / 100)).toFixed(3);
    const brcWeightKg = +(brcAreaRequired * unitWeight).toFixed(3);
    const brcWeightTonne = +(brcWeightKg / 1000).toFixed(4);

    // DPM
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

    // DPC
    let dpcResult = null;
    if (include_dpc) {
      let dpcPerim = dpc_perimeter_m;
      if (!dpcPerim && floor_areas.length > 0) {
        dpcPerim = +(4 * Math.sqrt(netArea) * 2).toFixed(3);
      }
      dpcResult = {
        total_length_m: +(dpcPerim * (1 + wastage_percent / 100)).toFixed(3),
        width_mm: dpc_width_mm,
        description: `${dpc_width_mm}mm wide damp proof course (polythene sheet) laid in cement mortar (1:3) at base of wall`
      };
    }

    // Herbicide
    let herbicideResult = null;
    if (include_herbicide) {
      const herbicideArea = +(netArea * (1 + wastage_percent / 100)).toFixed(3);
      herbicideResult = {
        area_m2: herbicideArea,
        description: 'Apply herbicide (Deldrex "20" or other equal and approved) treatment solution to faces of foundation concrete'
      };
    }

    // Oversite Concrete
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

    return {
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
    };
  }
}

module.exports = BrcDpmService;
