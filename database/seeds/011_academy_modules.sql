-- Seed 011: Academy Learning Modules
-- 7 pathways × 5 levels × 2-3 modules each = ~100 modules
-- Each module links to an existing resource or defines a quiz/exercise

-- ═══════════════════════════════════════════════════════════════
-- PATHWAY 1: Technical QS Practice (Consultancy)
-- ═══════════════════════════════════════════════════════════════

-- Level 1: Foundation (0-2 years)
INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
('technical-qs-practice', 1, 'Introduction to Quantity Surveying', 'Overview of the QS role in Nigerian construction projects', 'article', 1, 20, 10),
('technical-qs-practice', 1, 'Construction Drawings & Specifications', 'How to read and interpret architectural and structural drawings', 'article', 2, 25, 10),
('technical-qs-practice', 1, 'Foundation QS Quiz', 'Test your understanding of QS fundamentals', 'quiz', 3, 10, 15);

-- Level 2: Competent (2-5 years)
INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
('technical-qs-practice', 2, 'SMM7 Measurement Rules', 'Detailed study of Standard Method of Measurement 7th Edition', 'article', 1, 30, 15),
('technical-qs-practice', 2, 'Taking-Off Practice', 'Hands-on exercises in taking-off quantities from drawings', 'exercise', 2, 40, 20),
('technical-qs-practice', 2, 'Measurement & Quantification Quiz', 'Assess your measurement skills', 'quiz', 3, 15, 15);

-- Level 3: Proficient (5-8 years)
INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
('technical-qs-practice', 3, 'BOQ Preparation & Pricing', 'Complete bill of quantities preparation workflow', 'article', 1, 35, 20),
('technical-qs-practice', 3, 'Rate Analysis & Build-Up', 'Developing comprehensive rate analyses for Nigerian projects', 'article', 2, 30, 15),
('technical-qs-practice', 3, 'Advanced Measurement Case Study', 'Real-world measurement challenge with complex building elements', 'case_study', 3, 45, 25);

-- Level 4: Expert (8-12 years)
INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
('technical-qs-practice', 4, 'Value Engineering Techniques', 'Optimising costs without compromising quality', 'article', 1, 30, 20),
('technical-qs-practice', 4, 'Cost Planning & Control', 'Advanced cost management strategies for large projects', 'article', 2, 35, 20),
('technical-qs-practice', 4, 'Consultancy Practice Simulation', 'Simulate a real consultancy engagement from inception to completion', 'exercise', 3, 60, 30);

-- Level 5: Master (12+ years)
INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
('technical-qs-practice', 5, 'Strategic Advisory & Leadership', 'Leading QS teams and providing strategic cost advice', 'article', 1, 30, 25),
('technical-qs-practice', 5, 'Complex Dispute Resolution', 'Handling high-value construction disputes and arbitration', 'case_study', 2, 50, 30),
('technical-qs-practice', 5, 'Mastery Assessment', 'Comprehensive assessment of technical QS mastery', 'quiz', 3, 20, 20);

-- ═══════════════════════════════════════════════════════════════
-- PATHWAY 2: Construction Commercial Management
-- ═══════════════════════════════════════════════════════════════

INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
-- Level 1
('commercial-management', 1, 'Commercial Basics for QS', 'Understanding commercial principles in construction', 'article', 1, 20, 10),
('commercial-management', 1, 'Contract Administration Intro', 'Introduction to contract administration roles', 'article', 2, 25, 10),
('commercial-management', 1, 'Commercial Foundations Quiz', 'Test your commercial knowledge', 'quiz', 3, 10, 15),
-- Level 2
('commercial-management', 2, 'Cost Estimation Methods', 'Parametric, analytical, and elemental cost estimation', 'article', 1, 30, 15),
('commercial-management', 2, 'Bill of Quantities Pricing', 'Strategic pricing and markup considerations', 'exercise', 2, 35, 20),
('commercial-management', 2, 'Cost Management Quiz', 'Assess your cost estimation skills', 'quiz', 3, 15, 15),
-- Level 3
('commercial-management', 3, 'Valuation & Interim Certificates', 'Processing valuations and progress payments', 'article', 1, 30, 20),
('commercial-management', 3, 'Final Account Preparation', 'Compiling and negotiating final accounts', 'article', 2, 35, 20),
('commercial-management', 3, 'Commercial Management Case Study', 'Managing finances on a live construction project', 'case_study', 3, 45, 25),
-- Level 4
('commercial-management', 4, 'Risk Management & Allocation', 'Identifying and allocating commercial risks', 'article', 1, 30, 20),
('commercial-management', 4, 'Claims Management', 'Preparing and evaluating construction claims', 'article', 2, 35, 20),
('commercial-management', 4, 'Claims Workshop', 'Practice preparing a loss and expense claim', 'exercise', 3, 50, 30),
-- Level 5
('commercial-management', 5, 'Strategic Commercial Leadership', 'Leading commercial teams on major projects', 'article', 1, 30, 25),
('commercial-management', 5, 'Multi-Project Financial Control', 'Managing budgets across multiple concurrent projects', 'case_study', 2, 50, 30),
('commercial-management', 5, 'Commercial Mastery Exam', 'Comprehensive commercial management assessment', 'quiz', 3, 20, 20);

-- ═══════════════════════════════════════════════════════════════
-- PATHWAY 3: Construction Project Management
-- ═══════════════════════════════════════════════════════════════

INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
-- Level 1
('project-management', 1, 'Project Management Fundamentals', 'Core PM principles for construction', 'article', 1, 20, 10),
('project-management', 1, 'Construction Process Overview', 'Understanding the RIBA Plan of Work and Nigerian practice', 'article', 2, 25, 10),
('project-management', 1, 'PM Basics Quiz', 'Test your project management knowledge', 'quiz', 3, 10, 15),
-- Level 2
('project-management', 2, 'Planning & Scheduling', 'Network analysis, Gantt charts, and critical path', 'article', 1, 30, 15),
('project-management', 2, 'Resource Management', 'Labour, plant, and material resource planning', 'article', 2, 25, 15),
('project-management', 2, 'Planning Exercise', 'Create a project schedule from given parameters', 'exercise', 3, 40, 20),
-- Level 3
('project-management', 3, 'Contract Forms & Procurement', 'JCT, FIDIC, NEC, and Nigerian procurement routes', 'article', 1, 35, 20),
('project-management', 3, 'Quality Management', 'Quality assurance and control in construction', 'article', 2, 25, 15),
('project-management', 3, 'Procurement Case Study', 'Selecting the right procurement route for a real scenario', 'case_study', 3, 45, 25),
-- Level 4
('project-management', 4, 'Risk & Change Management', 'Managing project risks and change orders', 'article', 1, 30, 20),
('project-management', 4, 'Stakeholder Communication', 'Effective communication strategies for project teams', 'article', 2, 25, 15),
('project-management', 4, 'Project Recovery Exercise', 'Rescue a failing project scenario', 'exercise', 3, 50, 30),
-- Level 5
('project-management', 5, 'Programme Management', 'Managing multiple projects as a programme', 'article', 1, 30, 25),
('project-management', 5, 'Strategic Project Leadership', 'Leadership and team management in construction', 'case_study', 2, 45, 30),
('project-management', 5, 'PM Mastery Assessment', 'Comprehensive project management assessment', 'quiz', 3, 20, 20);

-- ═══════════════════════════════════════════════════════════════
-- PATHWAY 4: Real Estate & Property Advisory
-- ═══════════════════════════════════════════════════════════════

INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
-- Level 1
('real-estate-advisory', 1, 'Property Market Overview', 'Understanding the Nigerian real estate market', 'article', 1, 20, 10),
('real-estate-advisory', 1, 'Property Valuation Basics', 'Introduction to property valuation methods', 'article', 2, 25, 10),
('real-estate-advisory', 1, 'Real Estate Fundamentals Quiz', 'Test your property knowledge', 'quiz', 3, 10, 15),
-- Level 2
('real-estate-advisory', 2, 'Investment Analysis', 'ROI, yield, and investment appraisal techniques', 'article', 1, 30, 15),
('real-estate-advisory', 2, 'Development Appraisal', 'Financial viability assessments for development projects', 'exercise', 2, 40, 20),
('real-estate-advisory', 2, 'Valuation Methods Quiz', 'Assess your valuation skills', 'quiz', 3, 15, 15),
-- Level 3
('real-estate-advisory', 3, 'Estate Management', 'Managing residential and commercial estates', 'article', 1, 30, 20),
('real-estate-advisory', 3, 'Facilities Management', 'Building maintenance and operational management', 'article', 2, 25, 15),
('real-estate-advisory', 3, 'Property Advisory Case Study', 'Advising a client on a property acquisition', 'case_study', 3, 45, 25),
-- Level 4
('real-estate-advisory', 4, 'Portfolio Management', 'Managing a diversified property portfolio', 'article', 1, 30, 20),
('real-estate-advisory', 4, 'Market Research & Analysis', 'Conducting property market research', 'exercise', 2, 40, 25),
('real-estate-advisory', 4, 'Strategic Advisory Assessment', 'Strategic property advisory challenge', 'quiz', 3, 20, 20),
-- Level 5
('real-estate-advisory', 5, 'Property Finance & Investment', 'Advanced property finance structures', 'article', 1, 35, 25),
('real-estate-advisory', 5, 'Large-Scale Development Advisory', 'Advising on major development projects', 'case_study', 2, 50, 30),
('real-estate-advisory', 5, 'Real Estate Mastery Exam', 'Comprehensive real estate advisory assessment', 'quiz', 3, 20, 20);

-- ═══════════════════════════════════════════════════════════════
-- PATHWAY 5: Construction Dispute Resolution
-- ═══════════════════════════════════════════════════════════════

INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
-- Level 1
('dispute-resolution', 1, 'Dispute Resolution Overview', 'Understanding dispute types in construction', 'article', 1, 20, 10),
('dispute-resolution', 1, 'Nigerian Construction Law Basics', 'Key legal principles for construction professionals', 'article', 2, 25, 10),
('dispute-resolution', 1, 'Dispute Resolution Fundamentals Quiz', 'Test your legal knowledge', 'quiz', 3, 10, 15),
-- Level 2
('dispute-resolution', 2, 'Claims Prevention & Management', 'How to prevent and manage construction claims', 'article', 1, 30, 15),
('dispute-resolution', 2, 'Dispute Avoidance Strategies', 'Proactive approaches to dispute avoidance', 'article', 2, 25, 15),
('dispute-resolution', 2, 'Claims Workshop', 'Practice preparing a claim submission', 'exercise', 3, 40, 20),
-- Level 3
('dispute-resolution', 3, 'Adjudication Process', 'Statutory adjudication under Nigerian law', 'article', 1, 30, 20),
('dispute-resolution', 3, 'Mediation Techniques', 'Commercial mediation for construction disputes', 'article', 2, 25, 15),
('dispute-resolution', 3, 'Mediation Role Play', 'Simulate a mediation session', 'exercise', 3, 45, 25),
-- Level 4
('dispute-resolution', 4, 'Arbitration Proceedings', 'Construction arbitration under CIARB rules', 'article', 1, 35, 20),
('dispute-resolution', 4, 'Expert Witness Duties', 'Role and responsibilities of expert witnesses', 'article', 2, 25, 15),
('dispute-resolution', 4, 'Arbitration Case Study', 'Handle a complex arbitration scenario', 'case_study', 3, 50, 30),
-- Level 5
('dispute-resolution', 5, 'International Dispute Resolution', 'FIDIC dispute boards and international arbitration', 'article', 1, 30, 25),
('dispute-resolution', 5, 'High-Value Dispute Strategy', 'Strategic approach to multi-million naira disputes', 'case_study', 2, 50, 30),
('dispute-resolution', 5, 'Dispute Resolution Mastery', 'Comprehensive dispute resolution assessment', 'quiz', 3, 20, 20);

-- ═══════════════════════════════════════════════════════════════
-- PATHWAY 6: QS Technology & Digital Construction
-- ═══════════════════════════════════════════════════════════════

INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
-- Level 1
('digital-construction', 1, 'Digital QS Tools Overview', 'Software and tools used by modern QS professionals', 'article', 1, 20, 10),
('digital-construction', 1, 'Spreadsheet Mastery for QS', 'Advanced Excel/Google Sheets for quantity surveying', 'article', 2, 25, 10),
('digital-construction', 1, 'Digital Tools Quiz', 'Test your tech knowledge', 'quiz', 3, 10, 15),
-- Level 2
('digital-construction', 2, 'BIM for Quantity Surveyors', 'Building Information Modelling applications for QS', 'article', 1, 30, 15),
('digital-construction', 2, 'Digital Measurement Tools', 'Using Cubit, CostX, and other measurement software', 'article', 2, 25, 15),
('digital-construction', 2, 'BIM Exercise', 'Extract quantities from a BIM model', 'exercise', 3, 40, 20),
-- Level 3
('digital-construction', 3, 'Cloud-Based Cost Management', 'Collaborative cost management platforms', 'article', 1, 25, 15),
('digital-construction', 3, 'AI in Quantity Surveying', 'How AI is transforming cost estimation', 'article', 2, 30, 20),
('digital-construction', 3, 'Tech Integration Case Study', 'Implementing digital tools on a live project', 'case_study', 3, 45, 25),
-- Level 4
('digital-construction', 4, 'Data Analytics for QS', 'Using data to drive cost decisions', 'article', 1, 30, 20),
('digital-construction', 4, 'Automation & scripting', 'Automating repetitive QS tasks', 'exercise', 2, 40, 25),
('digital-construction', 4, 'Digital Transformation Assessment', 'Digital skills challenge', 'quiz', 3, 20, 20),
-- Level 5
('digital-construction', 5, 'Digital Strategy for QS Firms', 'Leading digital transformation in practice', 'article', 1, 30, 25),
('digital-construction', 5, 'PropTech & Innovation', 'Emerging technologies in construction', 'case_study', 2, 45, 30),
('digital-construction', 5, 'Digital Mastery Exam', 'Comprehensive digital construction assessment', 'quiz', 3, 20, 20);

-- ═══════════════════════════════════════════════════════════════
-- PATHWAY 7: Academic & Research Career
-- ═══════════════════════════════════════════════════════════════

INSERT INTO academy_modules (pathway_slug, level, title, description, module_type, order_index, duration_minutes, points) VALUES
-- Level 1
('academic-research', 1, 'Academic Writing Basics', 'Structure and style in academic writing', 'article', 1, 20, 10),
('academic-research', 1, 'Research Methodology Intro', 'Quantitative and qualitative research methods', 'article', 2, 25, 10),
('academic-research', 1, 'Research Fundamentals Quiz', 'Test your research knowledge', 'quiz', 3, 10, 15),
-- Level 2
('academic-research', 2, 'Literature Review Techniques', 'Conducting and writing literature reviews', 'article', 1, 30, 15),
('academic-research', 2, 'Data Collection Methods', 'Surveys, interviews, and case studies', 'article', 2, 25, 15),
('academic-research', 2, 'Research Design Exercise', 'Design a research study for a QS topic', 'exercise', 3, 40, 20),
-- Level 3
('academic-research', 3, 'Statistical Analysis for QS', 'Using statistics in construction research', 'article', 1, 35, 20),
('academic-research', 3, 'Thesis/Dissertation Planning', 'Structuring a research thesis', 'article', 2, 30, 15),
('academic-research', 3, 'Research Proposal Case Study', 'Develop a research proposal', 'case_study', 3, 45, 25),
-- Level 4
('academic-research', 4, 'Journal Publication Guide', 'Publishing research in academic journals', 'article', 1, 30, 20),
('academic-research', 4, 'Conference Presentation Skills', 'Preparing and delivering academic presentations', 'exercise', 2, 35, 20),
('academic-research', 4, 'Academic Career Assessment', 'Research skills challenge', 'quiz', 3, 20, 20),
-- Level 5
('academic-research', 5, 'Grant Writing & Funding', 'Securing research funding and grants', 'article', 1, 30, 25),
('academic-research', 5, 'Supervision & Mentoring', 'Guiding the next generation of researchers', 'case_study', 2, 40, 25),
('academic-research', 5, 'Academic Mastery Exam', 'Comprehensive academic assessment', 'quiz', 3, 20, 20);
