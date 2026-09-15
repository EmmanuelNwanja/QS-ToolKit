// ─── Scene Content Generator ───────────────────────────────────
// Generates structured content for each scene type via AI, with
// hardcoded Nigerian QS fallbacks when AI is unavailable.

const { callAI } = require('./aiService');
let logger;
try { logger = require('../utils/logger'); } catch { logger = console; }

// ─── Helpers ───────────────────────────────────────────────────
function parseJSON(raw) {
  return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

// ─── Lecture ───────────────────────────────────────────────────
async function generateLectureScene(topic, difficulty = 'intermediate', pathway = 'QS Practice') {
  const prompt = `You are Dr. Q, generating a lecture scene for Nigerian Quantity Surveying students.

Topic: ${topic}
Difficulty: ${difficulty}
Pathway: ${pathway}

Generate a structured lecture with sections, examples, and key points.
Reference Nigerian standards: SMM7, NRM2, NIQS. Use ₦ for costs.

Output ONLY valid JSON:
{
  "sections": [
    { "heading": "Section Title", "body": "Detailed explanation with Nigerian QS examples...", "examples": ["Example with Nigerian context"] }
  ],
  "key_points": ["Key point 1", "Key point 2", "Key point 3"],
  "objectives": ["By the end, you will be able to...", "..."]
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { type: 'lecture', topic, difficulty, content: parseJSON(raw) };
  } catch (err) {
    logger.warn('Lecture generation failed, using fallback:', err.message);
    return {
      type: 'lecture', topic, difficulty,
      content: {
        sections: [
          {
            heading: `Introduction to ${topic}`,
            body: `This lecture covers ${topic} as it applies to Quantity Surveying practice in Nigeria. We will explore the fundamental concepts, Nigerian standards (SMM7, NRM2), and practical applications in local construction projects.`,
            examples: [`A typical Lagos residential project applies ${topic} principles using Dangote cement rates and local aggregate pricing.`]
          },
          {
            heading: 'Nigerian Standards & Practice',
            body: `In Nigeria, ${topic} is governed by standards set by NIQS and referenced in SMM7/NRM2. The QS must understand how these standards apply to local conditions, material availability, and market pricing in ₦.`,
            examples: [`When preparing a BOQ for a Port Harcourt project, the QS accounts for higher transport costs and delta region material variations.`]
          }
        ],
        key_points: [
          `${topic} is a core skill for Nigerian QS professionals`,
          'Always reference SMM7/NRM2 standards in your work',
          'Nigerian market conditions require local adaptation of rates and practices'
        ],
        objectives: [
          `Understand the fundamentals of ${topic}`,
          `Apply ${topic} concepts to Nigerian construction projects`,
          `Reference relevant standards (SMM7, NRM2) when working with ${topic}`
        ]
      }
    };
  }
}

// ─── Quiz ──────────────────────────────────────────────────────
async function generateQuizScene(topic, difficulty = 'medium', count = 5) {
  const prompt = `You are Dr. Q, generating quiz questions for Nigerian Quantity Surveying students.

Topic: ${topic}
Difficulty: ${difficulty}
Number of questions: ${count}

Generate ${count} questions: mix of MCQ (4 options) and short answer.
Use Nigerian QS context: Naira, local materials, SMM7/NRM2.

Output ONLY valid JSON:
{
  "questions": [
    {
      "type": "mcq",
      "question": "Question text?",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correct_answer": "B",
      "explanation": "Why B is correct...",
      "marks": 2
    },
    {
      "type": "short_answer",
      "question": "Describe the process of...",
      "correct_answer": "Model answer text...",
      "explanation": "Grading criteria...",
      "marks": 5
    }
  ]
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { type: 'quiz', topic, difficulty, content: parseJSON(raw) };
  } catch (err) {
    logger.warn('Quiz generation failed, using fallback:', err.message);
    return {
      type: 'quiz', topic, difficulty,
      content: {
        questions: [
          {
            type: 'mcq',
            question: `In Nigerian QS practice, what is the standard coverage rate for emulsion paint?`,
            options: ['A. 5 m²/litre', 'B. 10 m²/litre', 'C. 15 m²/litre', 'D. 20 m²/litre'],
            correct_answer: 'B',
            explanation: 'Standard emulsion paint coverage in Nigeria is 10 m²/litre per coat. Two coats are standard for new plastered surfaces.',
            marks: 2
          },
          {
            type: 'mcq',
            question: `How many 9-inch sandcrete blocks are required per m² of wall?`,
            options: ['A. 8 blocks', 'B. 10 blocks', 'C. 12 blocks', 'D. 14 blocks'],
            correct_answer: 'B',
            explanation: '9-inch sandcrete blocks: 10 blocks/m². 6-inch: 12 blocks/m². 5-inch: 14 blocks/m².',
            marks: 2
          },
          {
            type: 'short_answer',
            question: `Explain the dry-to-wet volume factor for concrete and why it is important in Nigerian QS practice.`,
            correct_answer: 'The dry-to-wet volume factor is 1.54. When mixing concrete, dry materials compact when water is added, so 1m³ of dry materials produces approximately 1.54m³ of wet concrete. This factor must be accounted for in material quantity take-offs.',
            explanation: 'Students should mention 1.54 factor and its impact on cement bag calculations.',
            marks: 5
          }
        ]
      }
    };
  }
}

// ─── BOQ ───────────────────────────────────────────────────────
async function generateBOQScene(scenario = 'residential', difficulty = 'medium') {
  const prompt = `You are Dr. Q, generating a BOQ builder exercise for Nigerian QS students.

Scenario: ${scenario} project
Difficulty: ${difficulty}

Create a realistic BOQ scenario with line items, expected totals, and validation rules.
Use Nigerian market rates in ₦. Reference SMM7 item descriptions.

Output ONLY valid JSON:
{
  "scenario": "Description of the project scenario...",
  "line_items": [
    { "description": "Item description per SMM7", "unit": "m2|m3|nr|lot", "quantity": 100, "rate": 5000, "amount": 500000 }
  ],
  "expected_totals": { "subtotal": 0, "vat": 0, "grand_total": 0 },
  "validation_rules": ["Rule 1", "Rule 2"]
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { type: 'boq', scenario, difficulty, content: parseJSON(raw) };
  } catch (err) {
    logger.warn('BOQ generation failed, using fallback:', err.message);
    const items = [
      { description: 'Excavation in trenches for foundations', unit: 'm3', quantity: 45, rate: 3500, amount: 157500 },
      { description: 'Plain concrete blinding 75mm thick', unit: 'm3', quantity: 3.5, rate: 65000, amount: 227500 },
      { description: 'Reinforced concrete foundation C20', unit: 'm3', quantity: 12, rate: 185000, amount: 2220000 },
      { description: 'Sandcrete blockwork 150mm thick in cement mortar 1:6', unit: 'm2', quantity: 280, rate: 4500, amount: 1260000 },
      { description: 'Floor tiling 600×600mm ceramic', unit: 'm2', quantity: 120, rate: 5500, amount: 660000 },
      { description: 'Internal emulsion painting 2 coats', unit: 'm2', quantity: 350, rate: 2800, amount: 980000 }
    ];
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const vat = Math.round(subtotal * 0.075);
    return {
      type: 'boq', scenario, difficulty,
      content: {
        scenario: `A 3-bedroom residential bungalow project in Lagos. Prepare a BOQ for substructure and finishes work.`,
        line_items: items,
        expected_totals: { subtotal, vat, grand_total: subtotal + vat },
        validation_rules: [
          'All quantities must be net (no waste allowance in BOQ)',
          'Rates include material, labor, overheads, and profit',
          'VAT at 7.5% applies to Nigerian construction services'
        ]
      }
    };
  }
}

// ─── Rate Analysis ─────────────────────────────────────────────
async function generateRateAnalysisScene(topic = 'blockwork', difficulty = 'medium') {
  const prompt = `You are Dr. Q, generating a rate analysis exercise for Nigerian QS students.

Topic: ${topic} rate analysis
Difficulty: ${difficulty}

Create a detailed rate breakdown with materials, labor, plant, and components.
Use current Nigerian market rates in ₦.

Output ONLY valid JSON:
{
  "item_description": "Description of the work item",
  "unit": "m2|m3|nr|lot",
  "materials": [
    { "name": "Material", "unit": "kg|bag|piece|m", "quantity": 10, "rate_ngn": 500 }
  ],
  "labor": [
    { "role": "Skilled laborer", "hours": 4, "rate_per_hour_ngn": 250 }
  ],
  "plant": [
    { "name": "Equipment", "hours": 2, "rate_per_hour_ngn": 1500 }
  ],
  "overhead_pct": 15,
  "profit_pct": 10,
  "total_rate_ngn": 0
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { type: 'rate_analysis', topic, difficulty, content: parseJSON(raw) };
  } catch (err) {
    logger.warn('Rate analysis generation failed, using fallback:', err.message);
    const materials = [
      { name: 'Sandcrete blocks 150mm', unit: 'piece', quantity: 12.5, rate_ngn: 450 },
      { name: 'Cement 50kg', unit: 'bag', quantity: 0.5, rate_ngn: 6500 },
      { name: 'Sharp sand', unit: 'm3', quantity: 0.05, rate_ngn: 35000 }
    ];
    const labor = [{ role: 'Blocklayer', hours: 1.5, rate_per_hour_ngn: 500 }];
    const plant = [{ name: 'Mixer (0.5m³)', hours: 0.25, rate_per_hour_ngn: 3500 }];
    const matTotal = materials.reduce((s, m) => s + m.quantity * m.rate_ngn, 0);
    const labTotal = labor.reduce((s, l) => s + l.hours * l.rate_per_hour_ngn, 0);
    const plantTotal = plant.reduce((s, p) => s + p.hours * p.rate_per_hour_ngn, 0);
    const base = matTotal + labTotal + plantTotal;
    const overhead = Math.round(base * 0.15);
    const profit = Math.round((base + overhead) * 0.10);
    return {
      type: 'rate_analysis', topic, difficulty,
      content: {
        item_description: 'Sandcrete blockwork 150mm thick in cement mortar 1:6',
        unit: 'm2',
        materials, labor, plant,
        overhead_pct: 15,
        profit_pct: 10,
        total_rate_ngn: base + overhead + profit
      }
    };
  }
}

// ─── Measurement ───────────────────────────────────────────────
async function generateMeasurementScene(building_type = 'residential', difficulty = 'medium') {
  const prompt = `You are Dr. Q, generating a measurement takeoff exercise for Nigerian QS students.

Building type: ${building_type}
Difficulty: ${difficulty}

Create a set of building elements for measurement takeoff.
Reference NRM2 measurement rules.

Output ONLY valid JSON:
{
  "building_type": "${building_type}",
  "elements": [
    {
      "name": "Element name",
      "description": "Description with dimensions",
      "dimension": "L × W × H in metres",
      "formula": "L × H = quantity",
      "expected_quantity": 36,
      "unit": "m2|m3|m|nr"
    }
  ],
  "marking_criteria": "Accuracy of dimensions, correct unit selection, adherence to NRM2 rules"
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { type: 'measurement', building_type, difficulty, content: parseJSON(raw) };
  } catch (err) {
    logger.warn('Measurement generation failed, using fallback:', err.message);
    return {
      type: 'measurement', building_type, difficulty,
      content: {
        building_type,
        elements: [
          { name: 'External wall', description: 'External wall 9-inch blockwork', dimension: '12.0 × 3.0m', formula: 'L × H = 12.0 × 3.0', expected_quantity: 36, unit: 'm2' },
          { name: 'Internal wall', description: 'Internal partition 6-inch blockwork', dimension: '4.0 × 3.0m', formula: 'L × H = 4.0 × 3.0', expected_quantity: 12, unit: 'm2' },
          { name: 'Floor slab', description: 'Concrete floor slab 150mm', dimension: '6.0 × 4.0m', formula: 'L × W = 6.0 × 4.0', expected_quantity: 24, unit: 'm2' },
          { name: 'Excavation', description: 'Foundation trench excavation', dimension: '24.0 × 1.0 × 1.2m', formula: 'L × W × D = 24.0 × 1.0 × 1.2', expected_quantity: 28.8, unit: 'm3' }
        ],
        marking_criteria: 'Accuracy of dimensions, correct unit selection, adherence to NRM2 measurement rules'
      }
    };
  }
}

// ─── Cost Plan ─────────────────────────────────────────────────
async function generateCostPlanScene(project_type = 'residential', difficulty = 'medium') {
  const prompt = `You are Dr. Q, generating a cost plan exercise for Nigerian QS students.

Project type: ${project_type}
Difficulty: ${difficulty}

Create an elemental cost plan with percentage splits based on Nigerian building costs.
Use current market rates in ₦.

Output ONLY valid JSON:
{
  "building_type": "${project_type}",
  "location": "Lagos",
  "area_m2": 500,
  "total_estimated_cost_ngn": 75000000,
  "elements": [
    { "name": "Element name", "pct": 8, "estimated_cost_ngn": 6000000 }
  ],
  "preliminaries_pct": 15,
  "contingency_pct": 5,
  "notes": "Based on current Nigerian market rates"
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { type: 'cost_plan', project_type, difficulty, content: parseJSON(raw) };
  } catch (err) {
    logger.warn('Cost plan generation failed, using fallback:', err.message);
    const total = 75000000;
    const elements = [
      { name: 'Site Preparation', pct: 5, estimated_cost_ngn: Math.round(total * 0.05) },
      { name: 'Substructure', pct: 8, estimated_cost_ngn: Math.round(total * 0.08) },
      { name: 'Superstructure', pct: 25, estimated_cost_ngn: Math.round(total * 0.25) },
      { name: 'Roofing', pct: 10, estimated_cost_ngn: Math.round(total * 0.10) },
      { name: 'Finishes', pct: 15, estimated_cost_ngn: Math.round(total * 0.15) },
      { name: 'Services (MEP)', pct: 12, estimated_cost_ngn: Math.round(total * 0.12) },
      { name: 'External Works', pct: 5, estimated_cost_ngn: Math.round(total * 0.05) },
      { name: 'Furniture & Equipment', pct: 5, estimated_cost_ngn: Math.round(total * 0.05) }
    ];
    return {
      type: 'cost_plan', project_type, difficulty,
      content: {
        building_type: project_type,
        location: 'Lagos',
        area_m2: 500,
        total_estimated_cost_ngn: total,
        elements,
        preliminaries_pct: 15,
        contingency_pct: 5,
        notes: 'Based on current Nigerian market rates for Q3 2026'
      }
    };
  }
}

// ─── PBL ───────────────────────────────────────────────────────
async function generatePBLScene(topic = 'BOQ Preparation', difficulty = 'medium') {
  const prompt = `You are Dr. Q, generating a project-based learning scene for Nigerian QS students.

Topic: ${topic}
Difficulty: ${difficulty}

Create a milestone-based project with deliverables and a grading rubric.
Nigerian construction context.

Output ONLY valid JSON:
{
  "project_title": "Project Title",
  "description": "Project description...",
  "milestones": [
    { "title": "Milestone 1", "description": "What to do...", "deliverables": ["Deliverable 1"], "due_days": 7 }
  ],
  "rubric": [
    { "criterion": "Accuracy", "max_marks": 25, "description": "All quantities and rates are accurate" }
  ]
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { type: 'pbl', topic, difficulty, content: parseJSON(raw) };
  } catch (err) {
    logger.warn('PBL generation failed, using fallback:', err.message);
    return {
      type: 'pbl', topic, difficulty,
      content: {
        project_title: `Complete BOQ for a 3-Bedroom Residential Bungalow`,
        description: `Prepare a complete Bill of Quantities for a residential bungalow project in Lagos, Nigeria. You will work through measurement, rate analysis, and final BOQ compilation following SMM7/NRM2 standards.`,
        milestones: [
          { title: 'Site Measurement & Takeoff', description: 'Visit the site (or use provided drawings) and complete measurement takeoff for all elements.', deliverables: ['Measurement sheet', 'Dimensional check'], due_days: 7 },
          { title: 'Rate Analysis', description: 'Prepare rate analyses for all major work items using Nigerian market rates.', deliverables: ['Rate analysis sheets for 5 items', 'Market rate verification'], due_days: 14 },
          { title: 'BOQ Compilation', description: 'Compile the complete BOQ with all sections, quantities, and rates.', deliverables: ['Complete BOQ document', 'Summary sheet'], due_days: 21 },
          { title: 'Presentation & Review', description: 'Present your BOQ for peer review and defend your rates and measurements.', deliverables: ['Presentation slides', 'Self-assessment report'], due_days: 28 }
        ],
        rubric: [
          { criterion: 'Measurement Accuracy', max_marks: 25, description: 'All quantities measured correctly per NRM2 rules' },
          { criterion: 'Rate Application', max_marks: 25, description: 'Rates reflect current Nigerian market conditions' },
          { criterion: 'BOQ Format & Completeness', max_marks: 25, description: 'Follows SMM7 format, all sections present' },
          { criterion: 'Professional Presentation', max_marks: 25, description: 'Clear, organized, and professionally presented' }
        ]
      }
    };
  }
}

// ─── Discussion ────────────────────────────────────────────────
async function generateDiscussionScene(topic = 'Rate Variations in Nigerian Construction', difficulty = 'medium') {
  const prompt = `You are Dr. Q, generating a multi-agent discussion scene for Nigerian QS students.

Topic: ${topic}
Difficulty: ${difficulty}

Create a discussion with multiple agent personas debating a QS topic.

Output ONLY valid JSON:
{
  "topic": "${topic}",
  "agents": [
    { "name": "Dr. Q", "persona": "Teacher who explains concepts clearly", "role": "Moderator and educator" },
    { "name": "QS Practitioner", "persona": "Experienced Nigerian QS with 15 years practice", "role": "Real-world perspective" },
    { "name": "Student", "persona": "Curious learner asking clarifying questions", "role": "Learner advocate" }
  ],
  "prompts": ["Discussion prompt 1", "Discussion prompt 2"],
  "expected_turns": 6
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { type: 'discussion', topic, difficulty, content: parseJSON(raw) };
  } catch (err) {
    logger.warn('Discussion generation failed, using fallback:', err.message);
    return {
      type: 'discussion', topic, difficulty,
      content: {
        topic,
        agents: [
          { name: 'Dr. Q', persona: 'Teacher who explains concepts clearly and references Nigerian standards', role: 'Moderator and educator' },
          { name: 'QS Practitioner', persona: 'Experienced Nigerian QS with 15 years practice on major projects in Lagos and Abuja', role: 'Real-world perspective' },
          { name: 'Student', persona: 'Curious learner asking clarifying questions and representing the learner perspective', role: 'Learner advocate' }
        ],
        prompts: [
          `What are the main factors causing rate variations across Nigerian construction projects?`,
          `How should a QS handle rate disputes between clients and contractors in the Nigerian market?`,
          `What role does location (Lagos vs Abuja vs Port Harcourt) play in rate determination?`
        ],
        expected_turns: 6
      }
    };
  }
}

// ─── Dispatcher ────────────────────────────────────────────────
async function generateSceneContent(sceneType, topic, difficulty, options = {}) {
  const generators = {
    lecture: () => generateLectureScene(topic, difficulty, options.pathway),
    quiz: () => generateQuizScene(topic, difficulty, options.count),
    boq: () => generateBOQScene(options.scenario, difficulty),
    rate_analysis: () => generateRateAnalysisScene(topic, difficulty),
    measurement: () => generateMeasurementScene(options.building_type, difficulty),
    cost_plan: () => generateCostPlanScene(options.project_type, difficulty),
    pbl: () => generatePBLScene(topic, difficulty),
    discussion: () => generateDiscussionScene(topic, difficulty)
  };

  const gen = generators[sceneType];
  if (!gen) throw new Error(`Unknown scene type: ${sceneType}`);
  return gen();
}

module.exports = {
  generateLectureScene,
  generateQuizScene,
  generateBOQScene,
  generateRateAnalysisScene,
  generateMeasurementScene,
  generateCostPlanScene,
  generatePBLScene,
  generateDiscussionScene,
  generateSceneContent
};
