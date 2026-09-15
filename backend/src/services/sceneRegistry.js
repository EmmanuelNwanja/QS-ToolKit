// ─── Scene Type Registry ───────────────────────────────────────
// Central catalog of all scene types, their schemas, and grading modes.

const SCENE_TYPES = {
  lecture: {
    name: 'lecture',
    description: 'AI teacher delivers structured content with sections, examples, and key points',
    contentSchema: {
      sections: [{ heading: 'string', body: 'string', examples: ['string'] }],
      key_points: ['string'],
      objectives: ['string']
    },
    gradingType: 'none',
    estimatedMinutes: 15
  },

  quiz: {
    name: 'quiz',
    description: 'MCQ (4 options) + short answer with instant MCQ grading and AI short answer grading',
    contentSchema: {
      questions: [{
        type: 'mcq|short_answer',
        question: 'string',
        options: ['A. ...', 'B. ...', 'C. ...', 'D. ...'],
        correct_answer: 'string',
        explanation: 'string',
        marks: 'number'
      }]
    },
    gradingType: 'instant',
    estimatedMinutes: 10
  },

  boq: {
    name: 'boq',
    description: 'Interactive BOQ builder: user adds line items with AI validation',
    contentSchema: {
      scenario: 'string',
      line_items: [{
        description: 'string',
        unit: 'string',
        quantity: 'number',
        rate: 'number',
        amount: 'number'
      }],
      expected_totals: { subtotal: 'number', vat: 'number', grand_total: 'number' },
      validation_rules: ['string']
    },
    gradingType: 'ai',
    estimatedMinutes: 20
  },

  rate_analysis: {
    name: 'rate_analysis',
    description: 'Rate breakdown: material, labor, plant, components with Nigerian market rates',
    contentSchema: {
      item_description: 'string',
      unit: 'string',
      materials: [{ name: 'string', unit: 'string', quantity: 'number', rate_ngn: 'number' }],
      labor: [{ role: 'string', hours: 'number', rate_per_hour_ngn: 'number' }],
      plant: [{ name: 'string', hours: 'number', rate_per_hour_ngn: 'number' }],
      overhead_pct: 'number',
      profit_pct: 'number',
      total_rate_ngn: 'number'
    },
    gradingType: 'ai',
    estimatedMinutes: 15
  },

  measurement: {
    name: 'measurement',
    description: 'Building measurement takeoff: elements with dimensions, formulas, quantities',
    contentSchema: {
      building_type: 'string',
      elements: [{
        name: 'string',
        description: 'string',
        dimension: 'string',
        formula: 'string',
        expected_quantity: 'number',
        unit: 'string'
      }],
      marking_criteria: 'string'
    },
    gradingType: 'ai',
    estimatedMinutes: 20
  },

  cost_plan: {
    name: 'cost_plan',
    description: 'Elemental cost planning: site, building, external works, professional fees, contingencies',
    contentSchema: {
      building_type: 'string',
      location: 'string',
      area_m2: 'number',
      total_estimated_cost_ngn: 'number',
      elements: [{ name: 'string', pct: 'number', estimated_cost_ngn: 'number' }],
      preliminaries_pct: 'number',
      contingency_pct: 'number'
    },
    gradingType: 'ai',
    estimatedMinutes: 15
  },

  pbl: {
    name: 'pbl',
    description: 'Project-based learning: milestone-based project with deliverables and rubric',
    contentSchema: {
      project_title: 'string',
      description: 'string',
      milestones: [{
        title: 'string',
        description: 'string',
        deliverables: ['string'],
        due_days: 'number'
      }],
      rubric: [{ criterion: 'string', max_marks: 'number', description: 'string' }]
    },
    gradingType: 'ai',
    estimatedMinutes: 30
  },

  discussion: {
    name: 'discussion',
    description: 'Multi-agent debate: teacher and practitioner agents discuss a QS topic',
    contentSchema: {
      topic: 'string',
      agents: [{ name: 'string', persona: 'string', role: 'string' }],
      prompts: ['string'],
      expected_turns: 'number'
    },
    gradingType: 'none',
    estimatedMinutes: 10
  }
};

function getSceneType(type) {
  return SCENE_TYPES[type] || null;
}

function getAllSceneTypes() {
  return Object.values(SCENE_TYPES);
}

function getSceneTypeSchema(type) {
  const scene = SCENE_TYPES[type];
  return scene ? scene.contentSchema : null;
}

module.exports = { getSceneType, getAllSceneTypes, getSceneTypeSchema, SCENE_TYPES };
