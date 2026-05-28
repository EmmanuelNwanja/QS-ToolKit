# ADR-0001: Adopt Pocock Agent Skills + Multi-Framework Execution Discipline

## Status
Accepted

## Context
QSToolkit V1.10 has a solid backend (Node.js/Express + Supabase) and frontend (Next.js 14) but lacks:
1. A shared vocabulary for the QS domain in code and AI prompts
2. Consistent TDD and verification practices
3. Structured AI output with self-critique
4. A mechanism for the platform to learn from user behavior

Six open-source agent skill frameworks have emerged with proven patterns:
- **Matt Pocock Skills**: Shared language, grill sessions, TDD, diagnose loop
- **Superpowers**: Brainstorm → Worktree → Plan → Subagent-Driven Dev → Review → Finish
- **ECC**: Token optimization, memory persistence, continuous learning, pass@k verification
- **Ruflo**: Swarm coordination, GOAP planner, vector memory, self-learning (SONA)
- **Open Design**: Turn-1 discovery, 5-dim self-critique, skill-driven workflow
- **Karpathy**: Think before coding, simplicity first, surgical changes, goal-driven execution

We need to synthesize these into a QSToolkit-specific execution framework rather than copy-paste from any single source.

## Decision
We will adopt a unified agent execution framework defined in `AGENTS.md` and `CONTEXT.md` at the repo root, with the following infrastructure:

1. **AGENTS.md**: Operational rules synthesizing all six frameworks
2. **CONTEXT.md**: Canonical QS domain glossary (Nigerian standards, material constants, regional rates)
3. **docs/adr/**: Architecture decision records for major changes
4. **docs/prd/**: Feature specifications with P0/P1/P2 checklists and question-form discovery
5. **scripts/gate-check.mjs**: Unified pre-merge gate (lint + typecheck + smoke tests)
6. **scripts/setup-triage-labels.mjs**: Canonical GitHub labels for issue triage
7. **.agents/skills/**: Higgsfield AI skill configurations for image generation (DTC Ads)
8. **skills-lock.json**: Reproducible skill version tracking

## Consequences

### Positive
- Shared vocabulary reduces ambiguity in AI prompts and code reviews
- TDD + verification loops catch regressions before merge
- Self-critique gates improve AI output quality (determinism target: 95%)
- Learning loops enable the platform to improve while team sleeps
- Cost-aware model routing keeps AI spend predictable

### Negative
- Initial overhead: ~2 days to set up infrastructure
- New convention learning curve for contributors
- Additional database tables for sensor events and improvement runs

### Risks
- Frameworks may conflict; mitigation: AGENTS.md resolves conflicts explicitly
- Over-engineering; mitigation: Karpathy's "simplicity first" and "touch only what you must" rules

## Alternatives Considered
1. **Copy SolNuv's AGENTS.md verbatim** — Rejected. SolNuv is a solar platform; QSToolkit is a QS platform. Domain mismatch.
2. **Adopt only Pocock skills** — Rejected. TDD alone doesn't solve self-improvement or visual reasoning.
3. **Adopt only ECC** — Rejected. Token optimization alone doesn't solve Nigerian QS domain calibration.
4. **Wait for a single dominant framework** — Rejected. These frameworks are complementary, not competing.

## References
- mattpocock/skills (grill-me, tdd, diagnose, zoom-out, prototype)
- obra/superpowers (brainstorm, worktrees, subagent-driven dev)
- affaan-m/ECC (token optimization, memory persistence, continuous learning)
- ruvnet/ruflo (swarm, GOAP, SONA, AgentDB)
- nexu-io/open-design (question-form, 5-dim critique, anti-AI-slop)
- multica-ai/andrej-karpathy-skills (think first, simplicity, surgical changes)

---
*Date: 2026-05-27 | Author: QSToolkit Platform Intelligence Team*
