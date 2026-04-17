export const CALC_METHODS = {
  concrete: {
    standard: 'Nigerian site practice with dry-volume factor 1.54 and 50kg cement bag basis.',
    units: ['Dimensions in m', 'Volume in m3', 'Cement in 50kg bags'],
    steps: [
      'Element volume = length x width x thickness (or section dimensions for beams/columns).',
      'Net concrete volume = sum of element volumes.',
      'Wastage volume = net volume x (1 + wastage_percent/100).',
      'Dry volume = wet volume x 1.54.',
      'Materials split from mix ratio into cement, sand, and aggregate portions.'
    ]
  },
  masonry: {
    standard: 'Sandcrete blockwork take-off using wall area less openings and mortar allowances.',
    units: ['Area in m2', 'Blocks in count', 'Mortar in m3'],
    steps: [
      'Wall gross area = length x height.',
      'Net wall area = gross area - openings.',
      'Block count = net area x blocks_per_m2.',
      'Mortar quantity derived from net area and mortar factor per m2.',
      'Add wastage factor to blocks and mortar.'
    ]
  },
  plastering: {
    standard: 'SMM7/NRM2-aligned plaster/render quantity using net surface area after openings deductions.',
    units: ['Area in m2', 'Thickness in mm', 'Mortar in m3'],
    steps: [
      'Surface area = sum of wall/ceiling gross areas minus measured openings.',
      'Wet mortar volume = area x thickness(m).',
      'Dry mortar volume = wet volume x dry factor.',
      'Mix ratio allocation gives cement and sand quantities.',
      'Apply wastage percentage.'
    ]
  },
  paint: {
    standard: 'SMM7/NRM2-aligned paint estimation with mandatory openings deductions and coat coverage.',
    units: ['Area in m2', 'Paint in liters', 'Containers by size'],
    steps: [
      'Net paintable area = total area - deductions.',
      'Adjusted area = net area x number_of_coats.',
      'Liters required = adjusted area / coverage_per_liter.',
      'Primer/undercoat computed similarly when enabled.',
      'Convert liters to available can sizes.'
    ]
  },
  roofing: {
    standard: 'Longspan roofing estimate using effective sheet coverage and lap assumptions.',
    units: ['Roof lengths in m', 'Sheets in count', 'Area in m2'],
    steps: [
      'Determine roof geometry from plan and pitch.',
      'Compute slope length and effective sheet run.',
      'Sheet count = roof width / effective cover width.',
      'Rows/count adjusted for overlaps and end laps.',
      'Add wastage and accessories allowances.'
    ]
  },
  steel: {
    standard: 'BS 4449 style reinforcement take-off by diameter unit weights.',
    units: ['Length in m', 'Weight in kg'],
    steps: [
      'Total bar length = quantity x length per bar (including laps/anchors if supplied).',
      'Weight = total length x unit_weight_for_diameter.',
      'Aggregate steel weight = sum across all bar sizes.',
      'Wastage/cutting factor applied where configured.'
    ]
  },
  earthwork: {
    standard: 'SMM7/NRM2-ready earthwork with separated excavation, disposal, backfilling, compaction, and working-space allowances.',
    units: ['Volume in m3', 'Haulage loads in count'],
    steps: [
      'Effective excavation width includes working-space allowances.',
      'Excavation in-situ quantity is measured separately from disposal and backfilling.',
      'Loose disposal volume = in-situ excavation x bulking_factor minus compacted backfill.',
      'Construction method and excavation type influence productivity metadata.',
      'Compaction is reported as m3 or m2 based on selected unit.'
    ]
  },
  tiling: {
    standard: 'Tile estimate from floor area, tile module area, and wastage.',
    units: ['Area in m2', 'Tiles in count', 'Boxes in count'],
    steps: [
      'Net floor area = sum of room areas minus deductions.',
      'Tile count = net area / tile_area.',
      'Adjusted tile count = tile count x (1 + wastage_percent/100).',
      'Boxes = tiles / tiles_per_box.',
      'Grout estimate from coverage rate.'
    ]
  },
  carpentry: {
    standard: 'Roof timber take-off using geometric roof members and spacing assumptions.',
    units: ['Member lengths in m', 'Pieces in count'],
    steps: [
      'Perimeter-based members (wall plate/fascia) from roof perimeter.',
      'Rafter slope length from pitch geometry.',
      'Member counts from spacing assumptions (rafters, purlins, ties).',
      'Total timber by member type = count x member length.',
      'Apply wastage factor to each member class.'
    ]
  },
  formwork: {
    standard: 'Formwork measured by contact area: soffits and side faces.',
    units: ['Formwork area in m2'],
    steps: [
      'Slab soffit area = slab area less deductions where applicable.',
      'Beam formwork = 2 x side area + soffit area.',
      'Column formwork = perimeter x height.',
      'Stair and lintel components measured by exposed form contact area.',
      'Add wastage allowance to total area.'
    ]
  },
  'roof-accessories': {
    standard: 'Accessory count/length from ridge, valley, verge, and fixing spacing.',
    units: ['Linear lengths in m', 'Fixings in count'],
    steps: [
      'Ridge and valley lengths from roof geometry.',
      'Verge/barge lengths from roof type.',
      'Fixing straps/screws from spacing over total run lengths.',
      'Add handling/wastage percentage.'
    ]
  },
  'door-window': {
    standard: 'Door/window schedule measured by opening dimensions and counts.',
    units: ['Sizes in mm', 'Area in m2', 'Count in units'],
    steps: [
      'Opening area = width x height for each type.',
      'Total area by type = opening area x quantity.',
      'Schedules grouped by type/material as provided.',
      'Optional wastage/contingency added where configured.'
    ]
  },
  'brc-dpm': {
    standard: 'Mesh and membrane take-off by coverage area and lap allowances.',
    units: ['Area in m2', 'Rolls/sheets in count'],
    steps: [
      'Base area from slab/ground dimensions.',
      'Effective coverage = nominal coverage less lap overlaps.',
      'Mesh or DPM count = required area / effective coverage per roll/sheet.',
      'Include edge upturns and wastage where configured.'
    ]
  }
};

export function getCalculatorMethod(id) {
  return CALC_METHODS[id] || null;
}
