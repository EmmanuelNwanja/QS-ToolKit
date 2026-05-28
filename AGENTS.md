# QSToolkit Agent Execution Framework

This document defines the operational rules for AI agents working on the QSToolkit codebase. It synthesizes six proven skill frameworks into a unified, QSToolkit-specific execution discipline.

## Core Frameworks

| Framework | Author | Key Principle |
|-----------|--------|---------------|
| **Pocock Skills** | Matt Pocock | Shared language, grill before coding, TDD, diagnose loop |
| **Superpowers** | Obra | Brainstorm → Worktree → Plan → Subagent-Driven Dev → TDD → Review → Finish |
| **ECC** | Affaan | Token optimization, memory persistence, continuous learning, cost awareness |
| **Ruflo** | Ruvnet | Swarm coordination, GOAP planner, vector memory, self-learning |
| **Open Design** | Nexu-io | Turn-1 discovery, anti-AI-slop, 5-dim self-critique |
| **Karpathy** | Andrej | Think before coding, simplicity first, surgical changes, goal-driven |

---

## Before Coding

### 1. Think Before Coding (Karpathy)
State assumptions explicitly. Write down what you know, what you don't know, and what could go wrong. Minimum code that solves the problem.

### 2. Read CONTEXT.md
The `CONTEXT.md` file is the canonical shared language for the QSToolkit domain. Read it before any significant work. All domain terms used in code, PRs, and ADRs must align with the glossary.

### 3. Brainstorm (Superpowers)
For any feature >1 file or with UI impact, start with a 2-minute brainstorm. List at least 3 approaches. Choose the simplest that meets all requirements.

### 4. Grill Session (Pocock)
For complex features, run a `/grill-with-docs` session. Ask: What edge cases exist? What could break Nigerian QS standards? What would a Lagos QS practitioner disagree with?

### 5. Architecture Decision Record (Pocock)
If a change introduces a new pattern, dependency, or architecture:
- Create `docs/adr/NNNN-<decision-name>.md`
- Include: Context, Decision, Consequences, Status
- Example: `docs/adr/0001-adopt-pocock-agent-skills.md`

### 6. Feature Specification (Open Design)
For any feature >1 slice:
- Create `docs/prd/YYYY-MM-DD-<feature-name>.md`
- Must include P0/P1/P2 checklist
- Must start with `<question-form>` discovery (see Open Design)

---

## While Coding

### 7. Simplicity First (Karpathy)
- Touch only what you must. No speculative abstractions.
- Prefer duplication over the wrong abstraction.
- Each function does one thing and does it well.

### 8. Surgical Changes (Karpathy)
- State assumptions explicitly before modifying code.
- Transform imperative tasks into declarative goals with verifiable success criteria.
- Example: "Ensure all BOQ line items satisfy `quantity × rate == amount` within ₦0.01"

### 9. Test-Driven Development (Pocock)
- Write the test first. Watch it fail (red). Write the code (green). Refactor.
- For QSToolkit backend: add tests to `src/tests/`
- For frontend: add Jest/Vitest tests to `src/__tests__/`
- Every calculator must have golden test vectors.

### 10. Subagent-Driven Development (Superpowers)
- Decompose into bite-sized tasks (2–5 minutes each).
- Use subagents for parallel exploration or focused implementation.
- Maximum 3 subagent context negotiation cycles (ECC rule).

### 11. Token Optimization (ECC)
- Route models by cost/complexity: Haiku for FAQ/rate lookups, Sonnet for coding, Opus for architecture.
- Slim context: `buildUserContext()` returns only relevant projects, not all 10.
- Modular skills: load only the Dr. Q capability needed for the query.

### 12. Security Audit (Ruflo)
- On any change touching payments, auth, user data, or admin routes: `/security-scan`
- Check for: SQL injection via Supabase client, JWT bypass, rate limit gaps, Paystack webhook replay

### 13. Cost Awareness (ECC)
- Every AI call logs cost. If daily cost exceeds budget, fall back to mock mode.
- Prefer local computation (forecastingService.js, rateSuggestionService.js) over API calls.

---

## After Coding

### 14. Verification Loop (ECC)
- Run `npm run lint` (backend + frontend)
- Run `npm run test:qs`
- Run `scripts/gate-check.mjs` (unified gate)
- For visual features: screenshot and inspect.

### 15. Code Review (Superpowers)
Two-stage review:
1. **Self-review**: Check against the 5-dim critique (Open Design):
   - Philosophy: Nigerian QS standards?
   - Hierarchy: Information organized well?
   - Execution: Numbers self-consistent?
   - Specificity: Rates concrete and sourced?
   - Restraint: No hallucinations?
2. **Peer review**: For any file >100 lines or touching payments/auth.

### 16. Cleanup (Karpathy)
- Remove unused imports, commented code, debug logs.
- Ensure `logger` is used, not `console.log`.

### 17. Finish Branch (Superpowers)
- Squash commits if the branch is messy.
- Write a clear commit message referencing the ADR/PRD.
- Merge only after all gates pass.

---

## Meta Rules

### 18. Goal-Driven Execution (Karpathy)
Every task must have a verifiable success criterion. "Improve the Auto-BOQ" is not a goal. "Reduce Auto-BOQ edit distance from AI suggestion to final BOQ by 50% within 2 weeks" is.

### 19. Instinct Extraction (ECC/Ruflo)
After solving a novel bug or pattern:
- Document the pattern in `agent_instincts` table.
- Include: context, pattern, confidence score.
- Future agents load relevant instincts into prompt context.

### 20. Continuous Learning
- Every 2 weeks: review `sensor_events` for anomalies.
- Every month: review `improvement_runs` for patterns.
- Update this document if a new pattern proves valuable.

---

*Version: 1.0.0 | Synthesized for QSToolkit V1.10 → V1.20 upgrade*
