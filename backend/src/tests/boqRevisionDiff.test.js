const { _computeStructuredDiff: computeStructuredDiff } = require('../controllers/boqRevisionController');

const makeItem = (overrides) => ({
  id: `item-${Math.random().toString(36).slice(2, 8)}`,
  item_no: '1',
  description: 'Excavation',
  unit: 'm3',
  quantity: 10,
  rate: 5000,
  amount: 50000,
  ...overrides
});

const makeSection = (overrides) => ({
  id: `sec-${Math.random().toString(36).slice(2, 8)}`,
  title: 'Substructure',
  section_no: '1',
  boq_items: [makeItem()],
  ...overrides
});

const makeBoq = (overrides) => ({
  title: 'Test BOQ',
  client_name: 'Test Client',
  total_amount: 100000,
  status: 'draft',
  boq_sections: [makeSection()],
  ...overrides
});

describe('computeStructuredDiff', () => {
  test('returns no changes for identical BOQs', () => {
    const boq = makeBoq();
    const result = computeStructuredDiff(boq, boq);
    expect(result.changes).toHaveLength(0);
    expect(result.summary.total_changes).toBe(0);
    expect(result.summary.old_total).toBe(100000);
    expect(result.summary.new_total).toBe(100000);
    expect(result.summary.total_difference).toBe(0);
  });

  test('detects document-level field changes', () => {
    const old = makeBoq({ title: 'Old Title', total_amount: 100000 });
    const updated = makeBoq({ title: 'New Title', total_amount: 150000 });
    const result = computeStructuredDiff(old, updated);

    expect(result.changes).toHaveLength(2);
    const titleChange = result.changes.find((c) => c.field === 'title');
    expect(titleChange).toBeDefined();
    expect(titleChange.before).toBe('Old Title');
    expect(titleChange.after).toBe('New Title');
    expect(result.summary.total_difference).toBe(50000);
  });

  test('detects added items', () => {
    const oldSec = makeSection({ id: 's1', boq_items: [makeItem({ id: 'i1', description: 'Item 1' })] });
    const newSec = makeSection({
      id: 's1',
      boq_items: [
        makeItem({ id: 'i1', description: 'Item 1' }),
        makeItem({ id: 'i2', description: 'Item 2' })
      ]
    });
    const result = computeStructuredDiff(makeBoq({ boq_sections: [oldSec] }), makeBoq({ boq_sections: [newSec] }));

    const added = result.changes.filter((c) => c.type === 'added' && c.level === 'item');
    expect(added).toHaveLength(1);
    expect(added[0].description).toBe('Item 2');
    expect(result.summary.items_added).toBe(1);
  });

  test('detects removed items', () => {
    const oldSec = makeSection({
      id: 's1',
      boq_items: [makeItem({ id: 'i1', description: 'Item 1' }), makeItem({ id: 'i2', description: 'Item 2' })]
    });
    const newSec = makeSection({ id: 's1', boq_items: [makeItem({ id: 'i1', description: 'Item 1' })] });
    const result = computeStructuredDiff(makeBoq({ boq_sections: [oldSec] }), makeBoq({ boq_sections: [newSec] }));

    const removed = result.changes.filter((c) => c.type === 'removed' && c.level === 'item');
    expect(removed).toHaveLength(1);
    expect(removed[0].description).toBe('Item 2');
    expect(result.summary.items_removed).toBe(1);
  });

  test('detects modified items', () => {
    const oldSec = makeSection({ id: 's1', boq_items: [makeItem({ id: 'i1', quantity: 10, rate: 5000 })] });
    const newSec = makeSection({ id: 's1', boq_items: [makeItem({ id: 'i1', quantity: 20, rate: 5000 })] });
    const result = computeStructuredDiff(makeBoq({ boq_sections: [oldSec] }), makeBoq({ boq_sections: [newSec] }));

    const modified = result.changes.filter((c) => c.type === 'modified' && c.level === 'item');
    expect(modified).toHaveLength(1);
    expect(modified[0].changes.quantity).toEqual({ before: 10, after: 20 });
    expect(result.summary.items_modified).toBe(1);
  });

  test('detects added sections', () => {
    const oldBoq = makeBoq({ boq_sections: [] });
    const newBoq = makeBoq({ boq_sections: [makeSection({ id: 'new-sec', title: 'New Section' })] });
    const result = computeStructuredDiff(oldBoq, newBoq);

    const added = result.changes.filter((c) => c.type === 'added' && c.level === 'section');
    expect(added).toHaveLength(1);
    expect(added[0].section_title).toBe('New Section');
  });

  test('detects removed sections', () => {
    const oldBoq = makeBoq({ boq_sections: [makeSection({ id: 'old-sec', title: 'Old Section' })] });
    const newBoq = makeBoq({ boq_sections: [] });
    const result = computeStructuredDiff(oldBoq, newBoq);

    const removed = result.changes.filter((c) => c.type === 'removed' && c.level === 'section');
    expect(removed).toHaveLength(1);
    expect(removed[0].section_title).toBe('Old Section');
  });

  test('handles empty BOQs', () => {
    const old = makeBoq({ boq_sections: [] });
    const new = makeBoq({ boq_sections: [] });
    const result = computeStructuredDiff(old, new);
    expect(result.changes).toHaveLength(0);
  });

  test('handles BOQs with multiple items modified', () => {
    const oldSec = makeSection({
      id: 's1',
      boq_items: [
        makeItem({ id: 'i1', quantity: 10, rate: 5000, amount: 50000 }),
        makeItem({ id: 'i2', quantity: 5, rate: 3000, amount: 15000 })
      ]
    });
    const newSec = makeSection({
      id: 's1',
      boq_items: [
        makeItem({ id: 'i1', quantity: 20, rate: 5000, amount: 100000 }),
        makeItem({ id: 'i2', quantity: 5, rate: 3500, amount: 17500 })
      ]
    });
    const result = computeStructuredDiff(makeBoq({ boq_sections: [oldSec] }), makeBoq({ boq_sections: [newSec] }));

    expect(result.summary.items_modified).toBe(2);
    expect(result.changes.filter((c) => c.type === 'modified')).toHaveLength(2);
  });
});
