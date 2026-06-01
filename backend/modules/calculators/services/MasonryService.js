const blockDimensions = {
  '9inch':  { length: 450, height: 225, thickness: 225, face_area: 0.101 },
  '6inch':  { length: 450, height: 225, thickness: 150, face_area: 0.101 },
  '5inch':  { length: 450, height: 225, thickness: 125, face_area: 0.101 }
};

class MasonryService {
  static calculate({ walls = [], block_size = '9inch', mortar_ratio = '1:6', include_mortar = true, wastage_percent = 5 }) {
    const block = blockDimensions[block_size] || blockDimensions['9inch'];
    const blocksPerM2 = 1 / (block.face_area * 1.05);

    let totalArea = 0;
    const wallResults = walls.map(w => {
      const grossArea = w.length * w.height;
      const deductions = (w.openings || []).reduce((s, o) => s + o.width * o.height, 0);
      const netArea = Math.max(grossArea - deductions, 0);
      totalArea += netArea;
      return { ...w, gross_area_m2: +grossArea.toFixed(3), deductions_m2: +deductions.toFixed(3), net_area_m2: +netArea.toFixed(3) };
    });

    const blocksNeeded = Math.ceil(totalArea * blocksPerM2 * (1 + wastage_percent / 100));
    const mortarVolumeM3 = +(totalArea * 0.03).toFixed(3);
    const mortarParts = mortar_ratio === '1:4' ? { c: 1, s: 4, t: 5 } : { c: 1, s: 6, t: 7 };
    const cementBags = Math.ceil((mortarVolumeM3 * 1.33 * (mortarParts.c / mortarParts.t)) / 0.035);
    const sandM3 = +(mortarVolumeM3 * 1.33 * (mortarParts.s / mortarParts.t)).toFixed(3);

    return {
      walls: wallResults,
      summary: {
        total_wall_area_m2: +totalArea.toFixed(3),
        block_size,
        blocks_needed: blocksNeeded,
        wastage_included_percent: wastage_percent,
        mortar: include_mortar ? {
          mortar_ratio,
          cement_bags_50kg: cementBags,
          sharp_sand_m3: sandM3
        } : null
      }
    };
  }
}

module.exports = MasonryService;
