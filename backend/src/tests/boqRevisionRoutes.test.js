/**
 * BOQ Revision route tests.
 * These tests verify the route wiring and exported functions.
 * Run with: npx jest src/tests/boqRevisionRoutes.test.js --no-coverage
 */

const ctrl = require('../controllers/boqRevisionController');

describe('boqRevisionController exports', () => {
  test('exports createRevision function', () => {
    expect(typeof ctrl.createRevision).toBe('function');
  });

  test('exports listRevisions handler', () => {
    expect(typeof ctrl.listRevisions).toBe('function');
  });

  test('exports getRevision handler', () => {
    expect(typeof ctrl.getRevision).toBe('function');
  });

  test('exports compareRevisions handler', () => {
    expect(typeof ctrl.compareRevisions).toBe('function');
  });

  test('exports _computeStructuredDiff for testing', () => {
    expect(typeof ctrl._computeStructuredDiff).toBe('function');
  });
});

describe('computeStructuredDiff edge cases', () => {
  const { _computeStructuredDiff: computeStructuredDiff } = ctrl;

  test('handles BOQs with no sections', () => {
    const old = { title: 'T', total_amount: 0, boq_sections: [] };
    const newBoq = { title: 'T', total_amount: 0, boq_sections: [] };
    const result = computeStructuredDiff(old, newBoq);
    expect(result.summary.total_changes).toBe(0);
  });

  test('handles missing boq_sections gracefully', () => {
    const old = { title: 'T', total_amount: 0 };
    const newBoq = { title: 'T', total_amount: 0 };
    const result = computeStructuredDiff(old, newBoq);
    expect(result.summary.total_changes).toBe(0);
  });

  test('handles items with same UUID but different data', () => {
    const itemId = 'item-test-123';
    const old = {
      title: 'T', total_amount: 50000,
      boq_sections: [{
        id: 's1', title: 'Sec', boq_items: [
          { id: itemId, item_no: '1', description: 'Old desc', unit: 'm2', quantity: 10, rate: 5000, amount: 50000 }
        ]
      }]
    };
    const newBoq = {
      title: 'T', total_amount: 80000,
      boq_sections: [{
        id: 's1', title: 'Sec', boq_items: [
          { id: itemId, item_no: '1', description: 'New desc', unit: 'm2', quantity: 16, rate: 5000, amount: 80000 }
        ]
      }]
    };
    const result = computeStructuredDiff(old, newBoq);
    expect(result.summary.items_modified).toBe(1);
    expect(result.summary.total_difference).toBe(30000);
  });
});
