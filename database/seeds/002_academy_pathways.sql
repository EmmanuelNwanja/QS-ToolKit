-- ═══════════════════════════════════════════════════════════════
-- SEED: academy_pathways
-- 7 QS growth pathways with 5 levels each
-- ═══════════════════════════════════════════════════════════════

INSERT INTO academy_pathways (slug, title, description, focus_area, levels, is_active)
VALUES
-- ─── 1. TECHNICAL QS PRACTICE (CONSULTANCY) ──────────────────
(
  'technical-qs-practice',
  'Technical QS Practice (Consultancy)',
  'Master core quantity surveying skills — measurement, cost planning, bills of quantities, and client advisory. The traditional and most versatile QS career path.',
  'measurement,cost_planning,boq,client_advisory',
  '[
    {
      "level": 1,
      "title": "Assistant QS",
      "duration": "0-2 years",
      "competencies": [
        "Measurement fundamentals",
        "Taking-off",
        "Basic BOQ preparation",
        "Material identification"
      ],
      "outcomes": [
        "Can independently take-off from drawings",
        "Prepares basic bills of quantities",
        "Identifies and prices materials",
        "Supports senior QS on projects"
      ]
    },
    {
      "level": 2,
      "title": "Project QS",
      "duration": "2-5 years",
      "competencies": [
        "Cost planning",
        "Valuation",
        "Contract administration",
        "Bill preparation"
      ],
      "outcomes": [
        "Manages cost plans end-to-end",
        "Handles interim valuations",
        "Administers standard form contracts",
        "Prepares complete bills of quantities"
      ]
    },
    {
      "level": 3,
      "title": "Senior QS",
      "duration": "5-10 years",
      "competencies": [
        "Cost management",
        "Claims preparation",
        "Client advisory",
        "Project economics"
      ],
      "outcomes": [
        "Leads cost management on major projects",
        "Prepares and negotiates claims",
        "Advises clients on cost strategy",
        "Analyses project economic viability"
      ]
    },
    {
      "level": 4,
      "title": "Principal QS",
      "duration": "10-15 years",
      "competencies": [
        "Strategic cost advice",
        "Expert witness",
        "Business development",
        "Team leadership"
      ],
      "outcomes": [
        "Provides strategic cost advisory to clients",
        "Serves as expert witness in disputes",
        "Drives business development initiatives",
        "Leads and mentors QS teams"
      ]
    },
    {
      "level": 5,
      "title": "Partner/Director",
      "duration": "15+ years",
      "competencies": [
        "Firm leadership",
        "Major project oversight",
        "Industry influence",
        "Policy development"
      ],
      "outcomes": [
        "Leads consultancy firm direction",
        "Oversees flagship projects",
        "Influences industry standards and policy",
        "Shapes QS profession in Nigeria"
      ]
    }
  ]'::jsonb,
  true
),

-- ─── 2. CONSTRUCTION COMMERCIAL MANAGEMENT ───────────────────
(
  'commercial-management',
  'Construction Commercial Management',
  'Manage the commercial success of construction projects from the contractor''s side. Focus on P&L management, risk allocation, and commercial negotiations.',
  'commercial_management,risk,negotiations,project_finance',
  '[
    {
      "level": 1,
      "title": "Assistant Commercial QS",
      "duration": "0-2 years",
      "competencies": [
        "Subcontractor measurement",
        "Payment applications",
        "Cost tracking"
      ],
      "outcomes": [
        "Measures subcontractor works accurately",
        "Prepares and submits payment applications",
        "Tracks project costs against budget",
        "Supports commercial team on site"
      ]
    },
    {
      "level": 2,
      "title": "Commercial QS",
      "duration": "2-5 years",
      "competencies": [
        "Cost control",
        "Variations management",
        "Claims preparation"
      ],
      "outcomes": [
        "Implements cost control systems",
        "Manages variations and change orders",
        "Prepares claims with supporting documentation",
        "Monitors project margin and cash flow"
      ]
    },
    {
      "level": 3,
      "title": "Commercial Manager",
      "duration": "5-10 years",
      "competencies": [
        "Project P&L management",
        "Risk allocation",
        "Team leadership"
      ],
      "outcomes": [
        "Owns project P&L performance",
        "Allocates and mitigates commercial risks",
        "Leads commercial teams across projects",
        "Negotiates subcontracts and supplier agreements"
      ]
    },
    {
      "level": 4,
      "title": "Commercial Director",
      "duration": "10-15 years",
      "competencies": [
        "Portfolio commercial management",
        "Strategy",
        "Business growth"
      ],
      "outcomes": [
        "Manages commercial performance across portfolio",
        "Develops commercial strategy for the firm",
        "Drives business growth through commercial excellence",
        "Establishes commercial frameworks and policies"
      ]
    },
    {
      "level": 5,
      "title": "Commercial Director/CEO",
      "duration": "15+ years",
      "competencies": [
        "Board-level decisions",
        "Company leadership",
        "Market expansion"
      ],
      "outcomes": [
        "Makes board-level commercial decisions",
        "Leads company operations and strategy",
        "Expands into new markets and sectors",
        "Drives organisational profitability"
      ]
    }
  ]'::jsonb,
  true
),

-- ─── 3. CONSTRUCTION PROJECT MANAGEMENT ──────────────────────
(
  'project-management',
  'Construction Project Management',
  'Full project lifecycle management — time, cost, quality, scope. Bridge the gap between technical QS and project delivery.',
  'project_planning,stakeholder_management,risk_management,delivery',
  '[
    {
      "level": 1,
      "title": "Project Coordinator",
      "duration": "0-2 years",
      "competencies": [
        "Scheduling",
        "Coordination",
        "Documentation",
        "Progress tracking"
      ],
      "outcomes": [
        "Creates and maintains project schedules",
        "Coordinates between project teams",
        "Manages project documentation",
        "Tracks and reports progress"
      ]
    },
    {
      "level": 2,
      "title": "Project Manager",
      "duration": "3-5 years",
      "competencies": [
        "Stakeholder management",
        "Risk management",
        "Budget control"
      ],
      "outcomes": [
        "Manages stakeholder expectations and communication",
        "Identifies and mitigates project risks",
        "Controls project budget and timeline",
        "Delivers projects on time and within budget"
      ]
    },
    {
      "level": 3,
      "title": "Senior PM",
      "duration": "5-10 years",
      "competencies": [
        "Multi-project oversight",
        "Client relationships",
        "Programme management"
      ],
      "outcomes": [
        "Oversees multiple concurrent projects",
        "Builds and maintains client relationships",
        "Manages programme-level planning",
        "Mentors junior project managers"
      ]
    },
    {
      "level": 4,
      "title": "Programme Director",
      "duration": "10-15 years",
      "competencies": [
        "Portfolio governance",
        "Strategic alignment",
        "PMO leadership"
      ],
      "outcomes": [
        "Establishes portfolio governance frameworks",
        "Aligns projects with organisational strategy",
        "Leads and develops PMO capabilities",
        "Drives programme-level performance"
      ]
    },
    {
      "level": 5,
      "title": "Director of Projects/COO",
      "duration": "15+ years",
      "competencies": [
        "Organizational leadership",
        "Business strategy",
        "Vision"
      ],
      "outcomes": [
        "Leads organisational project delivery",
        "Shapes business strategy and direction",
        "Sets vision for project excellence",
        "Drives organisational transformation"
      ]
    }
  ]'::jsonb,
  true
),

-- ─── 4. REAL ESTATE & PROPERTY ADVISORY ─────────────────────
(
  'real-estate-advisory',
  'Real Estate & Property Advisory',
  'Feasibility studies, development appraisals, investment analysis, and property valuation. High-value advisory for property development.',
  'valuation,feasibility,investment_appraisal,property_development',
  '[
    {
      "level": 1,
      "title": "Valuation Assistant",
      "duration": "0-2 years",
      "competencies": [
        "Property measurement",
        "Basic valuation methods",
        "Market research"
      ],
      "outcomes": [
        "Meets properties accurately per RICS standards",
        "Applies basic valuation methods (comparison, investment)",
        "Conducts market research and analysis",
        "Supports senior valuers on instructions"
      ]
    },
    {
      "level": 2,
      "title": "Development Appraiser",
      "duration": "2-5 years",
      "competencies": [
        "Feasibility studies",
        "Financial modelling",
        "DCF analysis"
      ],
      "outcomes": [
        "Prepares comprehensive feasibility studies",
        "Builds financial models for developments",
        "Conducts discounted cash flow analysis",
        "Advises on development viability"
      ]
    },
    {
      "level": 3,
      "title": "Senior Valuer",
      "duration": "5-10 years",
      "competencies": [
        "Investment appraisal",
        "Portfolio management",
        "Market analysis"
      ],
      "outcomes": [
        "Conducts complex investment appraisals",
        "Manages property portfolios for clients",
        "Provides in-depth market analysis",
        "Leads valuation instructions end-to-end"
      ]
    },
    {
      "level": 4,
      "title": "Real Estate Advisor",
      "duration": "10-15 years",
      "competencies": [
        "High-value advisory",
        "Expert witness",
        "Development strategy"
      ],
      "outcomes": [
        "Provides high-value property advisory",
        "Serves as expert witness in property disputes",
        "Advises on development strategy and phasing",
        "Builds trusted client relationships"
      ]
    },
    {
      "level": 5,
      "title": "Managing Director/CEO",
      "duration": "15+ years",
      "competencies": [
        "Company leadership",
        "Major developments",
        "Market influence"
      ],
      "outcomes": [
        "Leads real estate advisory firm",
        "Oversees major development projects",
        "Influences property market direction",
        "Drives firm growth and reputation"
      ]
    }
  ]'::jsonb,
  true
),

-- ─── 5. CONSTRUCTION DISPUTE RESOLUTION ─────────────────────
(
  'dispute-resolution',
  'Construction Dispute Resolution',
  'Claims preparation, delay analysis, dispute resolution, and expert witness. High-value niche with international arbitration opportunities.',
  'claims,delay_analysis,arbitration,expert_witness',
  '[
    {
      "level": 1,
      "title": "Claims Analyst",
      "duration": "0-2 years",
      "competencies": [
        "Documentation",
        "Basic delay analysis",
        "Record keeping"
      ],
      "outcomes": [
        "Organises and maintains project records",
        "Conducts basic delay analysis",
        "Supports claims preparation with data",
        "Assists in dispute documentation"
      ]
    },
    {
      "level": 2,
      "title": "Claims Consultant",
      "duration": "2-5 years",
      "competencies": [
        "EOT claims",
        "Variations",
        "Cost impact analysis"
      ],
      "outcomes": [
        "Prepares extension of time claims",
        "Manages variations claims process",
        "Analyses cost impacts of delays",
        "Advises on claims strategy"
      ]
    },
    {
      "level": 3,
      "title": "Quantum Expert",
      "duration": "5-10 years",
      "competencies": [
        "Complex claims",
        "Expert reports",
        "Arbitration support"
      ],
      "outcomes": [
        "Handles complex multi-party claims",
        "Prepares expert quantum reports",
        "Supports arbitration proceedings",
        "Provides quantum advisory in disputes"
      ]
    },
    {
      "level": 4,
      "title": "Expert Witness",
      "duration": "10-15 years",
      "competencies": [
        "International arbitration",
        "Tribunal evidence",
        "ICC/LCIA"
      ],
      "outcomes": [
        "Acts as expert witness in international arbitration",
        "Gives evidence before tribunals",
        "Handles ICC and LCIA arbitration proceedings",
        "Builds international dispute practice"
      ]
    },
    {
      "level": 5,
      "title": "Head of Dispute Resolution",
      "duration": "15+ years",
      "competencies": [
        "Firm leadership",
        "High-profile cases",
        "Industry reputation"
      ],
      "outcomes": [
        "Leads dispute resolution practice",
        "Handles landmark high-profile cases",
        "Builds industry-wide reputation",
        "Shapes dispute resolution standards"
      ]
    }
  ]'::jsonb,
  true
),

-- ─── 6. QS TECHNOLOGY & DIGITAL CONSTRUCTION ────────────────
(
  'digital-construction',
  'QS Technology & Digital Construction',
  'BIM, digital twins, AI-powered cost estimation, and construction technology. The future of quantity surveying.',
  'bim,digital_twins,ai_estimation,construction_tech',
  '[
    {
      "level": 1,
      "title": "BIM Coordinator",
      "duration": "0-2 years",
      "competencies": [
        "BIM software (Revit, CostX)",
        "Digital measurement",
        "Data entry"
      ],
      "outcomes": [
        "Operates BIM software for QS workflows",
        "Performs digital measurement from models",
        "Enters and validates cost data digitally",
        "Supports BIM implementation on projects"
      ]
    },
    {
      "level": 2,
      "title": "BIM Manager",
      "duration": "2-5 years",
      "competencies": [
        "BIM implementation",
        "Data analytics",
        "Process optimization"
      ],
      "outcomes": [
        "Implements BIM standards and workflows",
        "Analyses construction data for insights",
        "Optimises cost processes through technology",
        "Trains teams on digital tools"
      ]
    },
    {
      "level": 3,
      "title": "Digital Construction Director",
      "duration": "5-10 years",
      "competencies": [
        "Technology strategy",
        "Innovation management",
        "Team leadership"
      ],
      "outcomes": [
        "Develops digital construction strategy",
        "Manages technology innovation pipeline",
        "Leads digital teams and initiatives",
        "Drives digital transformation across projects"
      ]
    },
    {
      "level": 4,
      "title": "Chief Digital Officer",
      "duration": "10-15 years",
      "competencies": [
        "Technology vision",
        "Industry transformation",
        "Startup advisory"
      ],
      "outcomes": [
        "Sets technology vision for the organisation",
        "Drives industry-wide digital transformation",
        "Advises construction technology startups",
        "Establishes digital innovation partnerships"
      ]
    },
    {
      "level": 5,
      "title": "PropTech CEO",
      "duration": "15+ years",
      "competencies": [
        "Startup leadership",
        "Business scaling",
        "Venture leadership"
      ],
      "outcomes": [
        "Leads property technology ventures",
        "Scales digital solutions globally",
        "Drives venture growth and investment",
        "Shapes the future of construction technology"
      ]
    }
  ]'::jsonb,
  true
),

-- ─── 7. ACADEMIC & RESEARCH CAREER ──────────────────────────
(
  'academic-research',
  'Academic & Research Career',
  'Teaching, research, policy development, and curriculum design. Shape the future of quantity surveying education in Nigeria.',
  'teaching,research,policy,curriculum_design',
  '[
    {
      "level": 1,
      "title": "Graduate Assistant",
      "duration": "0-2 years",
      "competencies": [
        "Teaching support",
        "Research methodology",
        "Lab supervision"
      ],
      "outcomes": [
        "Supports lecturers in course delivery",
        "Learns and applies research methodologies",
        "Supervises laboratory and practical sessions",
        "Assists with student assessment"
      ]
    },
    {
      "level": 2,
      "title": "Lecturer",
      "duration": "2-7 years",
      "competencies": [
        "Course delivery",
        "Publications",
        "Student supervision"
      ],
      "outcomes": [
        "Delivers courses independently",
        "Publishes in peer-reviewed journals",
        "Supervises undergraduate and postgraduate students",
        "Contributes to curriculum development"
      ]
    },
    {
      "level": 3,
      "title": "Senior Lecturer",
      "duration": "7-12 years",
      "competencies": [
        "Research leadership",
        "Grant acquisition",
        "PhD supervision"
      ],
      "outcomes": [
        "Leads research groups and projects",
        "Secures research grants and funding",
        "Supervises PhD candidates",
        "Mentors junior academics"
      ]
    },
    {
      "level": 4,
      "title": "Associate Professor",
      "duration": "12-17 years",
      "competencies": [
        "Academic leadership",
        "Conference presentations",
        "Policy input"
      ],
      "outcomes": [
        "Leads academic programmes and departments",
        "Presents at national and international conferences",
        "Provides input on education and industry policy",
        "Builds academic reputation and networks"
      ]
    },
    {
      "level": 5,
      "title": "Professor/HOD/Dean",
      "duration": "17+ years",
      "competencies": [
        "Faculty leadership",
        "Policy influence",
        "Academic governance"
      ],
      "outcomes": [
        "Leads faculty or department",
        "Influences national education policy",
        "Participates in academic governance",
        "Shapes the future of QS education in Nigeria"
      ]
    }
  ]'::jsonb,
  true
);

-- ═══════════════════════════════════════════════════════════════
-- Summary: 7 pathways × 5 levels = 35 career progression stages
-- Each level includes competencies and outcomes as JSONB arrays
-- ═══════════════════════════════════════════════════════════════
