# Feature Specification: QS Academy & QS Exam Prep

**Date:** 2026-06-14
**Author:** Dr. Q Engineering Team
**Status:** Draft → Implementation
**Priority:** P0 — Revenue-critical features

---

## 1. Discovery

### Question Form
> How do we transform QSToolkit from a tool-only platform into a learning + certification ecosystem that generates recurring revenue while genuinely advancing the careers of Nigerian quantity surveyors?

### Context
QSToolkit currently serves as a utility platform (calculators, BOQs, invoices). Two new revenue streams — **QS Academy** (learning) and **QS Exam Prep** (exam preparation) — will:
- Add ₦2,000/week per feature as subscription add-ons
- Drive user engagement and retention
- Create a network effect via knowledge test arenas
- Position QSToolkit as the definitive Nigerian QS career platform

---

## 2. QS Academy

### 2.1 Overview
A structured learning platform with AI-powered personalized pathways, resource library, and competitive knowledge test arena.

### 2.2 Pricing
- **₦2,000/week** add-on (billed separately from base subscription)
- Only users with active base subscription (basic/pro/enterprise) can purchase
- First exam trial free for all subscribers

### 2.3 User Flow: First-Time Academy Access

```
Dashboard → Click "Academy" menu
  │
  ├── [NEW USER] → Strengths & Weaknesses Declaration Modal
  │     │
  │     ├── Step 1: Select 3 strengths from QS competency list
  │     ├── Step 2: Select 3 weaknesses from same list
  │     └── Step 3: Confirm → Dr. Q "thinking" animation
  │           │
  │           ├── "Preparing your unique growth pathway..."
  │           ├── "Working on your assessment..."
  │           └── Test Ready → Prompt to start
  │
  ├── [EXISTING USER] → Academy Dashboard
  │     ├── My Pathway (recommended + custom)
  │     ├── Resource Library
  │     ├── Knowledge Arena
  │     └── Progress Analytics
  │
  └── [TRIAL USER] → Limited access (1 exam only)
```

### 2.4 Pre-Academy Admission Test

**7-question timed assessment** generated uniquely per user by Dr. Q based on their declared strengths and weaknesses.

**Question types:**
- Multiple choice (4 options)
- True/False
- Calculation (numeric input)
- Scenario-based (describe approach)

**Scoring:**
- Each question: 10 points max
- Time limit: 15 minutes total (auto-submit at timeout)
- Results determine: recommended pathway + starting level

### 2.5 QS Growth Pathways (7 Pathways)

Each pathway has 5 levels (Entry → Expert) with defined competencies and real-world outcomes.

#### Pathway 1: Technical QS Practice (Consultancy)
- **Focus:** Measurement, cost planning, BOQs, client advisory
- **Levels:** Assistant QS → Project QS → Senior QS → Principal QS → Partner/Director
- **Outcomes:** MNIQS/MRICS chartership, ₦5M–₦25M+ earnings
- **Certifications:** NIQS → RICS → FNIQS

#### Pathway 2: Construction Commercial Management
- **Focus:** Contractor-side commercial management, P&L, claims
- **Levels:** Assistant Commercial QS → Commercial QS → Commercial Manager → Commercial Director → CEO
- **Outcomes:** Strong commercial acumen, ₦8M–₦30M+ earnings
- **Certifications:** NIQS + CIOB → PMP

#### Pathway 3: Construction Project Management
- **Focus:** Full lifecycle — time, cost, quality, scope
- **Levels:** Project Coordinator → Project Manager → Senior PM → Programme Director → Director of Projects
- **Outcomes:** PMP/PRINCE2, international opportunities, ₦6M–₦20M+ earnings

#### Pathway 4: Real Estate & Property Advisory
- **Focus:** Feasibility, valuation, development appraisal, investment analysis
- **Levels:** Valuation Assistant → Development Appraiser → Senior Valuer → Real Estate Advisor → MD/CEO
- **Outcomes:** RICS Valuation pathway, ₦5M–₦25M+ earnings

#### Pathway 5: Construction Dispute Resolution
- **Focus:** Claims, delay analysis, arbitration, expert witness
- **Levels:** Claims Analyst → Claims Consultant → Quantum Expert → Expert Witness → Head of Dispute Resolution
- **Outcomes:** CIArb, international arbitration, ₦8M–₦30M+ earnings

#### Pathway 6: QS Technology & Digital Construction
- **Focus:** BIM, AI-powered estimation, construction tech, digital twins
- **Levels:** BIM Coordinator → BIM Manager → Digital Construction Director → CTO → PropTech CEO
- **Outcomes:** Tech-forward career, ₦6M–₦20M+ earnings

#### Pathway 7: Academic & Research Career
- **Focus:** Teaching, research, policy, curriculum design
- **Levels:** Graduate Assistant → Lecturer → Senior Lecturer → Associate Professor → Professor/Dean
- **Outcomes:** PhD, research grants, policy influence, ₦3M–₦12M+ earnings

### 2.6 Resource Library Structure

**Organized by pathway + level, with Nigerian context.**

| Category | Content Types |
|----------|--------------|
| Fundamentals | Measurement standards (SMM7/NRM2), Construction technology, Materials science |
| Professional Practice | NIQS regulations, QSRBN requirements, Professional ethics, Contract forms |
| Cost Management | Cost planning, Valuation, Bills of quantities, Final accounts |
| Contracts & Law | JCT, FIDIC, Nigerian procurement law, Arbitration act |
| Technology | BIM (Revit, CostX), Digital measurement, AI in QS |
| Exam Prep | NIQS past questions, RICS APC prep, Professional competency |
| Career | CV writing, Interview prep, Portfolio building, Networking |

**Resource formats:** Articles, PDFs, video links, interactive quizzes, case studies

### 2.7 Knowledge Test Arena

**Competition modes:**
1. **1v1 Duel:** Challenge a specific user by username/email
2. **1v~ Group:** Open challenge, anyone can join
3. **User vs Dr. Q:** AI-generated adaptive difficulty quiz
4. **Scheduled Contest:** Pro+ users can schedule contests, invite participants

**Scoring system:**
- Points per correct answer (scaled by difficulty)
- Time bonus (faster = more points)
- Streak bonus (consecutive correct answers)
- Lateness penalty: -2 points per minute late (max 10 min grace)
- Points deposited as tokens in user profile
- Tokens contribute to leaderboard ranking

**Contest flow:**
1. Creator sets: topic, question count (5/10/15), time limit, difficulty
2. Invitations sent (or open to all)
3. At scheduled time: all participants get same questions simultaneously
4. Real-time leaderboard during contest
5. Results declared: winner announced, all points deposited
6. Results feed into academy progress analytics

### 2.8 Progress Analytics Dashboard

- Pathway completion percentage (per level)
- Knowledge test scores over time
- Strengths/weaknesses heatmap (from admission test + arena performance)
- Tokens earned (weekly/monthly/all-time)
- Arena win/loss/draw record
- Recommended next steps (AI-powered)
- Comparison with peers (anonymized)

---

## 3. QS Exam Prep

### 3.1 Overview
Exam preparation platform covering Nigerian professional exams, international certifications, and university past questions.

### 3.2 Pricing
- **₦2,000/week** add-on (billed separately from base subscription)
- Only users with active base subscription can purchase
- First exam trial free for all subscribers

### 3.3 User Flow

```
Dashboard → Click "Exam Prep" menu
  │
  ├── Professional Exams
  │     ├── Nigerian Exams
  │     │     ├── QSRBN Registration Prep
  │     │     ├── NIQS Probation Exam
  │     │     ├── NIQS Intermediate Exam
  │     │     ├── NIQS GDE (Graduateship)
  │     │     ├── NIQS TPC (Test of Professional Competence)
  │     │     ├── NIQS PCI (Professional Competence Interview)
  │     │     └── Job Interview Prep
  │     │
  │     └── International Exams
  │           ├── RICS APC (QS & Construction)
  │           ├── CIOB Chartered Membership
  │           ├── PMP Certification
  │           └── PRINCE2 Foundation/Practitioner
  │
  ├── Student Exams
  │     ├── University Past Questions
  │     │     ├── Select University → Select Year → Select Course
  │     │     ├── Timed mode (exam conditions) or Untimed (practice)
  │     │     └── Post-exam: AI explanations for wrong answers
  │     │
  │     └── Mock Exams
  │           ├── Nigerian Professional Exam Mocks
  │           └── International Exam Mocks
  │
  └── My Results
        ├── Exam history
        ├── Score trends
        └── Weakness areas
```

### 3.4 Exam Content Structure

#### Nigerian Professional Exams

**QSRBN Registration Prep:**
- Topics: QS practice fundamentals, Nigerian construction standards, Professional ethics
- Format: 50 MCQs, 90 minutes
- Pass mark: 70%

**NIQS Probation Exam:**
- Topics: Basic QS duties, Construction technology, Professional practice
- Format: 40 MCQs + 10 short answers, 120 minutes
- Pass mark: 60%

**NIQS Intermediate Exam:**
- Topics: Intermediate measurement, Cost planning, Contract administration
- Format: 30 MCQs + 5 long questions, 180 minutes
- Pass mark: 60%

**NIQS GDE (Graduateship):**
- Topics: QS Professional Practice, Measurement, Cost Planning, Contracts
- Format: 6 papers (1 per topic), each 120 minutes
- Pass mark: 50% per paper

**NIQS TPC (Test of Professional Competence):**
- Topics: Advanced QS practice, Commercial management, Contract administration, Claims
- Format: 4 papers, case study-based, 180 minutes each
- Pass mark: 50% per paper

**NIQS PCI Prep:**
- Format: Mock interview questions, portfolio review guidance
- Covers: Professional experience defense, Ethics scenarios, Project case studies

**Job Interview Prep:**
- Topics: QS interview questions, Technical competency tests, Situational judgment
- Format: 30 MCQs + 10 scenario-based questions
- Includes: Common Nigerian QS firm interview patterns

#### International Exams

**RICS APC (QS & Construction):**
- Competency areas: Commercial management, Cost planning, Contract practice, Procurement, Quantification
- Format: 50 MCQs per competency area, 60 minutes each
- Mock final assessment: 1-hour simulated interview

**CIOB Chartered Membership:**
- Topics: Construction management, Leadership, Health & safety, Sustainability
- Format: 40 MCQs + case studies, 120 minutes

**PMP Certification:**
- Domains: People, Process, Business Environment
- Format: 180 MCQs (split across 3 sections), 230 minutes
- Based on PMBOK 7th Edition

**PRINCE2:**
- Themes: Business case, Organization, Quality, Plans, Risk, Change, Progress
- Format: Foundation (75 MCQs, 60 min) + Practitioner (objective testing, 150 min)

#### University Past Questions

**Supported universities (initial set):**
1. Obafemi Awolowo University (OAU)
2. University of Lagos (UNILAG)
3. Ahmadu Bello University (ABU Zaria)
4. Federal University of Technology, Akure (FUTA)
5. Federal University of Technology, Owerri (FUTO)
6. Nnamdi Azikiwe University
7. University of Ilorin
8. University of Jos
9. Rivers State University
10. Federal University of Technology, Minna

**Past question structure:**
- Year, Course code, Course title
- Questions organized by topic
- Model answers with step-by-step workings
- AI explanations for clarification

### 3.5 AI Support Flow

When a user gets a question wrong:
1. Show correct answer with green highlight
2. Show user's wrong answer with red highlight
3. Show "View Explanation" button
4. AI generates detailed explanation including:
   - Step-by-step calculation (if applicable)
   - Formula used
   - Common mistakes to avoid
   - Related concepts to study
5. "Ask Dr. Q" button for follow-up questions

### 3.6 Trial System

- Every subscriber gets **1 free exam** (any exam type)
- After trial: must purchase Exam Prep add-on (₦2,000/week)
- Trial tracked per user in `exam_trial_used` field

---

## 4. Database Schema

### New Tables

```sql
-- Academy subscription tracking
CREATE TABLE academy_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- active/expired/cancelled
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  paystack_reference TEXT,
  amount_paid DECIMAL(10,2) DEFAULT 2000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Exam Prep subscription tracking
CREATE TABLE exam_prep_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  paystack_reference TEXT,
  amount_paid DECIMAL(10,2) DEFAULT 2000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- User strengths/weaknesses declaration
CREATE TABLE academy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strengths TEXT[] NOT NULL DEFAULT '{}',
  weaknesses TEXT[] NOT NULL DEFAULT '{}',
  recommended_pathway TEXT,
  admission_score INTEGER,
  admission_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Academy admission test
CREATE TABLE academy_admission_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  questions JSONB NOT NULL, -- [{question, options, correct_answer, type, difficulty}]
  answers JSONB, -- {question_index: selected_answer}
  score INTEGER,
  time_limit_seconds INTEGER DEFAULT 900, -- 15 minutes
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' -- in_progress/completed/timed_out
);

-- Growth pathways
CREATE TABLE academy_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  focus_area TEXT NOT NULL,
  levels JSONB NOT NULL, -- [{level: 1, title, competencies[], outcomes[]}]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User pathway progress
CREATE TABLE academy_pathway_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pathway_id UUID NOT NULL REFERENCES academy_pathways(id),
  current_level INTEGER DEFAULT 1,
  completion_pct DECIMAL(5,2) DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, pathway_id)
);

-- Resource library
CREATE TABLE academy_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id UUID REFERENCES academy_pathways(id),
  category TEXT NOT NULL, -- fundamentals/professional_practice/cost_management/...
  level INTEGER NOT NULL, -- 1-5
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- markdown content
  resource_type TEXT NOT NULL, -- article/quiz/case_study/video
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge test arena contests
CREATE TABLE academy_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id),
  contest_type TEXT NOT NULL, -- duel/group/dr_q/scheduled
  topic TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 10,
  time_limit_seconds INTEGER NOT NULL DEFAULT 600,
  difficulty TEXT NOT NULL DEFAULT 'medium', -- easy/medium/hard
  scheduled_at TIMESTAMPTZ, -- for scheduled contests
  status TEXT NOT NULL DEFAULT 'pending', -- pending/active/completed
  questions JSONB, -- generated questions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contest participants
CREATE TABLE academy_contest_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES academy_contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  score INTEGER DEFAULT 0,
  tokens_earned INTEGER DEFAULT 0,
  answers JSONB, -- {question_index: {answer, time_spent}}
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  lateness_minutes INTEGER DEFAULT 0,
  UNIQUE(contest_id, user_id)
);

-- User tokens (from arena)
CREATE TABLE academy_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL, -- contest/daily_bonus/achievement
  reference_id UUID, -- contest_id or other reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exam questions bank
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_category TEXT NOT NULL, -- nigerian_professional/international/university
  exam_name TEXT NOT NULL, -- e.g., "NIQS Probation", "RICS APC", "OAU QSA 301"
  topic TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- mcq/short_answer/calculation/true_false/scenario
  options JSONB, -- [{label: "A", text: "..."}]
  correct_answer TEXT NOT NULL,
  explanation TEXT, -- model answer / explanation
  difficulty TEXT NOT NULL DEFAULT 'medium',
  year INTEGER, -- for past questions
  university TEXT, -- for university past questions
  course_code TEXT, -- for university past questions
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exam attempts
CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_category TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  questions JSONB NOT NULL, -- [{question_id, question_text, options, correct_answer}]
  answers JSONB, -- {question_index: selected_answer}
  score INTEGER,
  total_questions INTEGER NOT NULL,
  time_limit_seconds INTEGER NOT NULL,
  timed BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress',
  is_trial BOOLEAN DEFAULT FALSE
);

-- Exam trial tracking
CREATE TABLE exam_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_category TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  attempt_id UUID REFERENCES exam_attempts(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
```

---

## 5. API Routes

### Academy Routes (`/api/v1/academy/`)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/status` | Yes | Check academy subscription status |
| POST | `/subscribe` | Yes | Initiate academy subscription (Paystack) |
| POST | `/profile` | Yes | Save strengths/weaknesses |
| GET | `/profile` | Yes | Get user profile |
| POST | `/admission/start` | Yes | Start admission test |
| POST | `/admission/submit` | Yes | Submit admission test answers |
| GET | `/admission/result` | Yes | Get admission test result |
| GET | `/pathways` | Yes | List all pathways |
| GET | `/pathways/:slug` | Yes | Get pathway detail |
| POST | `/pathways/:slug/enroll` | Yes | Enroll in pathway |
| GET | `/pathways/progress` | Yes | Get user's pathway progress |
| GET | `/resources` | Yes | List resources (filterable) |
| GET | `/resources/:id` | Yes | Get resource content |
| POST | `/contests` | Yes | Create contest |
| GET | `/contests` | Yes | List available contests |
| POST | `/contests/:id/join` | Yes | Join contest |
| POST | `/contests/:id/submit` | Yes | Submit contest answers |
| GET | `/contests/:id/results` | Yes | Get contest results |
| GET | `/tokens` | Yes | Get user's token balance |
| GET | `/analytics` | Yes | Get progress analytics |

### Exam Prep Routes (`/api/v1/exam-prep/`)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/status` | Yes | Check exam prep subscription status |
| POST | `/subscribe` | Yes | Initiate exam prep subscription (Paystack) |
| GET | `/exams` | Yes | List available exams (filterable) |
| GET | `/exams/:id/questions` | Yes | Get exam questions |
| POST | `/exams/:id/start` | Yes | Start exam attempt |
| POST | `/exams/:id/submit` | Yes | Submit exam answers |
| GET | `/attempts` | Yes | Get user's exam history |
| GET | `/attempts/:id` | Yes | Get attempt detail + explanations |
| GET | `/universities` | Yes | List supported universities |
| GET | `/universities/:id/courses` | Yes | List courses for university |
| GET | `/past-questions` | Yes | Get past questions (filterable) |

---

## 6. Frontend Pages

### New Pages
| Route | Page | Auth |
|-------|------|------|
| `/academy` | Academy Dashboard | Yes |
| `/academy/pathways` | Pathway Browser | Yes |
| `/academy/pathways/[slug]` | Pathway Detail + Enroll | Yes |
| `/academy/resources` | Resource Library | Yes |
| `/academy/arena` | Knowledge Test Arena | Yes |
| `/academy/arena/[id]` | Contest Page | Yes |
| `/exam-prep` | Exam Prep Dashboard | Yes |
| `/exam-prep/professional` | Professional Exams | Yes |
| `/exam-prep/professional/[slug]` | Exam Detail + Start | Yes |
| `/exam-prep/students` | Student Exams | Yes |
| `/exam-prep/students/[universityId]` | University Past Questions | Yes |
| `/exam-prep/results` | My Results | Yes |

### New Modals
| Modal | Trigger | Description |
|-------|---------|-------------|
| Strengths & Weaknesses Declaration | First Academy click | 3 strengths + 3 weaknesses selection |
| Dr. Q Thinking Animation | After declaration | AI processing animation |
| Admission Test | After thinking | 7-question timed test |
| Admission Result | After test | Score + recommended pathway |
| Contest Lobby | Join contest | Waiting room for scheduled contests |
| Contest Results | End of contest | Winner announcement + points |

---

## 7. Payment Integration

### Paystack Plan Setup
Create two new Paystack plans:
- `academy_weekly` — ₦2,000/week
- `exam_prep_weekly` — ₦2,000/week

### Payment Flow
1. User clicks "Subscribe to Academy/Exam Prep"
2. Backend initializes Paystack transaction
3. User completes payment on Paystack
4. Webhook/verify activates the add-on subscription
5. Subscription tracked in `academy_subscriptions` / `exam_prep_subscriptions` table
6. Expiry checked on each request (7-day rolling)

---

## 8. Admin Dashboard Updates

### New Admin Pages
| Route | Description |
|-------|-------------|
| `/admin/academy` | Academy analytics (enrollments, completion rates, popular pathways) |
| `/admin/exam-prep` | Exam prep analytics (attempts, pass rates, popular exams) |
| `/admin/arena` | Arena analytics (contests created, participants, tokens distributed) |
| `/admin/content` | Content management (add/edit questions, resources) |

### New Analytics Metrics
- Academy subscribers (active/expired/churned)
- Exam Prep subscribers (active/expired/churned)
- Revenue from add-ons (weekly/monthly)
- Most popular pathways
- Most popular exams
- Arena engagement (contests/day, avg participants)
- Token distribution
- Question bank size (by category/exam)
- Average exam scores
- Pass rates by exam type

---

## 9. Leaderboard Integration

### New Leaderboard Columns
```sql
-- Added to leaderboard materialized view
total_academy_tokens INTEGER DEFAULT 0,
arena_wins INTEGER DEFAULT 0,
arena_losses INTEGER DEFAULT 0,
academy_courses_completed INTEGER DEFAULT 0,
avg_exam_score DECIMAL(5,2) DEFAULT 0
```

### Leaderboard Categories
- `academy_tokens` — Sort by total tokens earned
- `arena_wins` — Sort by arena victories
- `exam_scores` — Sort by average exam scores

---

## 10. Phased Implementation

### Phase 1: Foundation (Week 1)
- [ ] Database migrations for all new tables
- [ ] Backend route registration
- [ ] Academy subscription payment flow
- [ ] Exam Prep subscription payment flow
- [ ] Frontend subscription pages

### Phase 2: Academy Core (Week 2)
- [ ] Strengths/weaknesses declaration modal
- [ ] Dr. Q admission test generation
- [ ] Admission test modal + scoring
- [ ] Pathway recommendation engine
- [ ] Academy dashboard

### Phase 3: Content & Resources (Week 3)
- [ ] Resource library seeding (articles, case studies)
- [ ] Resource browsing UI
- [ ] Content management admin

### Phase 4: Knowledge Arena (Week 4)
- [ ] Contest creation + joining
- [ ] Question generation by Dr. Q
- [ ] Real-time contest execution
- [ ] Token system + leaderboard integration

### Phase 5: Exam Prep (Week 5)
- [ ] Question bank seeding (Nigerian professional exams)
- [ ] Question bank seeding (international exams)
- [ ] University past question structure
- [ ] Exam attempt flow + scoring
- [ ] AI explanation generation

### Phase 6: Polish & Admin (Week 6)
- [ ] Progress analytics dashboard
- [ ] Admin analytics pages
- [ ] UI/UX polish
- [ ] Performance optimization
- [ ] Testing

---

*Version: 1.0.0 | QSToolkit Feature Specification*
