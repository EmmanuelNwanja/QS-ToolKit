const assert = require('assert');
const {
  normalizeStandard,
  validateBoqForFinalization
} = require('../services/measurementStandardService');

function run() {
  assert.strictEqual(normalizeStandard('smm7'), 'SMM7');
  assert.strictEqual(normalizeStandard('NRM2'), 'NRM2');
  assert.strictEqual(normalizeStandard(''), null);

  const invalidBoq = {
    measurement_standard: 'INVALID',
    boq_sections: []
  };

  const invalidResult = validateBoqForFinalization(invalidBoq);
  assert.strictEqual(invalidResult.ok, false);
  assert.ok(invalidResult.errors.length >= 2);

  const validBoq = {
    measurement_standard: 'SMM7',
    boq_sections: [
      {
        section_type: 'preliminaries',
        boq_items: [
          {
            item_no: 'P1',
            description: 'Site setup',
            material_type: 'n/a',
            thickness_or_mix: 'n/a',
            finish_type: 'n/a'
          }
        ]
      },
      {
        section_type: 'measured_work',
        boq_items: [
          {
            item_no: 'M1',
            description: 'Painting to walls',
            material_type: 'Emulsion',
            thickness_or_mix: '2 coats',
            finish_type: 'Matt',
            remarks: 'Opening deduction applied'
          }
        ]
      }
    ]
  };

  const validResult = validateBoqForFinalization(validBoq);
  assert.strictEqual(validResult.ok, true);

  const warningBoq = {
    measurement_standard: 'NRM2',
    boq_sections: [
      {
        section_type: 'preliminaries',
        boq_items: [{ item_no: 'P1', description: 'Site security' }]
      },
      {
        section_type: 'measured_work',
        boq_items: [
          {
            item_no: 'M2',
            description: 'Painting to ceilings',
            material_type: 'Acrylic',
            thickness_or_mix: '2 coats',
            finish_type: 'Eggshell',
            remarks: 'No deductions stated'
          }
        ]
      }
    ]
  };
  const warningResult = validateBoqForFinalization(warningBoq);
  assert.strictEqual(warningResult.ok, true);
  assert.ok(warningResult.warnings.length >= 1);
}

run();
