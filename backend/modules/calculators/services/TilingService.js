class TilingService {
  static calculate({ rooms = [], tile_length_m = 0.6, tile_width_m = 0.6, wastage_percent = 10, grout_bag_covers_m2 = 5 }) {
    const tileArea = tile_length_m * tile_width_m;
    let totalArea = 0;

    const roomResults = rooms.map(r => {
      const area = r.length * r.width;
      totalArea += area;
      return { ...r, area_m2: +area.toFixed(3) };
    });

    const tilesNeeded = Math.ceil((totalArea / tileArea) * (1 + wastage_percent / 100));
    const groutBags = Math.ceil(totalArea / grout_bag_covers_m2);
    const tilesPerBox = tile_length_m === 0.6 ? 4 : tile_length_m === 0.4 ? 6 : 4;
    const boxesNeeded = Math.ceil(tilesNeeded / tilesPerBox);

    return {
      rooms: roomResults,
      summary: {
        total_floor_area_m2: +totalArea.toFixed(3),
        tile_size: `${tile_length_m * 1000}mm x ${tile_width_m * 1000}mm`,
        tiles_needed: tilesNeeded,
        boxes_needed: boxesNeeded,
        tiles_per_box: tilesPerBox,
        grout_bags: groutBags,
        wastage_percent
      }
    };
  }
}

module.exports = TilingService;
