const { _computeStructuredDiff: computeDiff } = require('../../src/controllers/boqRevisionController');

describe('TRACKED_FIELDS diff in projectController', () => {
  // Simulate the field comparison logic used in projectController.update
  const TRACKED_FIELDS = ['title', 'client_name', 'client_email', 'project_type', 'location', 'state', 'description', 'start_date', 'end_date', 'estimated_value', 'final_value', 'status'];

  test('detects changed fields between current and update', () => {
    const current = { title: 'Old Title', client_name: 'Alice', status: 'active', estimated_value: 5000000 };
    const update = { title: 'New Title', client_name: 'Alice', status: 'completed', estimated_value: 5000000 };

    const historyRows = [];
    for (const field of TRACKED_FIELDS) {
      if (update[field] !== undefined && String(update[field]) !== String(current[field])) {
        historyRows.push({ field_name: field, old_value: String(current[field]), new_value: String(update[field]) });
      }
    }

    expect(historyRows).toHaveLength(2);
    expect(historyRows.map(r => r.field_name)).toContain('title');
    expect(historyRows.map(r => r.field_name)).toContain('status');
  });

  test('detects no changes when fields match', () => {
    const current = { title: 'Same', status: 'active' };
    const update = { title: 'Same', status: 'active' };

    const historyRows = [];
    for (const field of TRACKED_FIELDS) {
      if (update[field] !== undefined && String(update[field]) !== String(current[field])) {
        historyRows.push({ field_name: field });
      }
    }

    expect(historyRows).toHaveLength(0);
  });

  test('handles null/undefined values', () => {
    const current = { title: null, description: undefined };
    const update = { title: 'New', description: 'Has value' };

    const historyRows = [];
    for (const field of TRACKED_FIELDS) {
      if (update[field] !== undefined && String(update[field]) !== String(current[field])) {
        historyRows.push({ field_name: field, old_value: current[field] != null ? String(current[field]) : null, new_value: update[field] });
      }
    }

    expect(historyRows).toHaveLength(2);
    expect(historyRows[0].old_value).toBeNull();
    expect(historyRows[0].new_value).toBe('New');
  });

  test('handles numeric fields correctly', () => {
    const current = { estimated_value: 5000000 };
    const update = { estimated_value: '7500000' }; // string from form input

    const historyRows = [];
    for (const field of TRACKED_FIELDS) {
      if (update[field] !== undefined && String(update[field]) !== String(current[field])) {
        historyRows.push({ field_name: field, old_value: String(current[field]), new_value: String(update[field]) });
      }
    }

    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].old_value).toBe('5000000');
    expect(historyRows[0].new_value).toBe('7500000');
  });
});
