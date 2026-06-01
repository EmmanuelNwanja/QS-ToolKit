const doorTypes = {
  'double_leaf_steel':  'Purpose double leaf steel doors complete with steel frame, installed with all needed accessories, fitting to blockwall in CAS (1:4) mortar',
  'single_leaf_steel':  'Purpose single leaf steel doors, fixed to steel frame, installed with all accessories, fitting to blockwall in CAS (1:4) mortar',
  'single_leaf_panel':  'Purpose single leaf panel doors fixed to wooden frame, installed with all accessories, fitting to blockwall in CAS (1:4.5) mortar',
  'single_leaf_flush':  'Purpose single leaf flush doors complete with wooden frame, installed with all needed accessories, fitting to blockwall in CAS (1:4.5) mortar',
  'custom': 'Custom door type'
};

const windowTypes = {
  'sliding_aluminium':  'Two track–two panel cream anodized aluminium framed sliding glass windows fixed to manufacturer\'s details',
  'casement_aluminium': 'Cream anodized aluminium framed casement projected glass windows fixed to manufacturer\'s details',
  'louvre':             'Aluminium framed louvre windows, fixed to manufacturer\'s details',
  'fixed_light':        'Fixed aluminium framed glass light, fixed to manufacturer\'s details',
  'custom': 'Custom window type'
};

class DoorWindowService {
  static calculate({ doors = [], windows = [], burglary_proof = [] }) {
    // Process doors
    let totalDoorArea = 0;
    const doorSchedule = doors.map(d => {
      const area = +((d.width_mm / 1000) * (d.height_mm / 1000) * d.quantity).toFixed(4);
      totalDoorArea += area;
      return {
        ref: d.ref,
        type: d.type,
        description: doorTypes[d.type] || doorTypes['custom'],
        size: `${d.width_mm} × ${d.height_mm}mm`,
        quantity: d.quantity,
        total_area_m2: area,
        material: d.material || 'As specified',
        note: d.note || ''
      };
    });

    // Process windows
    let totalWindowArea = 0;
    const windowSchedule = windows.map(w => {
      const area = +((w.width_mm / 1000) * (w.height_mm / 1000) * w.quantity).toFixed(4);
      totalWindowArea += area;
      return {
        ref: w.ref,
        type: w.type,
        description: windowTypes[w.type] || windowTypes['custom'],
        size: `${w.width_mm} × ${w.height_mm}mm`,
        quantity: w.quantity,
        total_area_m2: area,
        material: w.material || 'Aluminium',
        note: w.note || ''
      };
    });

    // Process burglary proofs
    let totalBpArea = 0;
    const bpSchedule = burglary_proof.map(bp => {
      const area = +((bp.width_mm / 1000) * (bp.height_mm / 1000) * bp.quantity).toFixed(4);
      totalBpArea += area;
      return {
        ref: bp.ref,
        size: `${bp.width_mm} × ${bp.height_mm}mm`,
        quantity: bp.quantity,
        total_area_m2: area,
        mesh_type: bp.mesh_type || '25×25mm hollow square pipe',
        description: '25×25mm hollow square pipe cut and joined into approved design, including painting in red oxide paint, plugging into blockwall and concrete work'
      };
    });

    const totalOpeningsArea = +(totalDoorArea + totalWindowArea).toFixed(3);

    return {
      door_schedule: {
        items: doorSchedule,
        total_quantity: doors.reduce((s, d) => s + d.quantity, 0),
        total_area_m2: +totalDoorArea.toFixed(3)
      },
      window_schedule: {
        items: windowSchedule,
        total_quantity: windows.reduce((s, w) => s + w.quantity, 0),
        total_area_m2: +totalWindowArea.toFixed(3)
      },
      burglary_proof_schedule: {
        items: bpSchedule,
        total_quantity: burglary_proof.reduce((s, b) => s + b.quantity, 0),
        total_area_m2: +totalBpArea.toFixed(3)
      },
      summary: {
        total_door_openings: doors.reduce((s, d) => s + d.quantity, 0),
        total_window_openings: windows.reduce((s, w) => s + w.quantity, 0),
        total_opening_area_m2: totalOpeningsArea,
        note: 'Total opening area can be used as deduction from blockwall measurement'
      }
    };
  }
}

module.exports = DoorWindowService;
