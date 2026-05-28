# Skill: qs-self-improvement

Recursive self-improvement loops for the QSToolkit platform.

## The Five-Layer Loop

```
Sensor → Policy → Tool → Quality Gate → Learn
```

## Sensor Types

| Sensor | Source Table | Detects |
|--------|-------------|---------|
| calculator | `calculator_usage` | Re-run patterns, common errors |
| boq | `boq_documents`, `boq_revisions` | Edit distance, creation time |
| rate | `smart_rate_suggestions` | Override rate, acceptance rate |
| forecast | `project_cost_forecasts` | MAPE, systematic bias |
| support | `ai_conversations` | Recurring topics, unresolved queries |
| drawing | `drawing_primitive_feedback` | Missed rooms, false positives |
| conversion | `users`, `invoices` | Funnel drop-offs |

## Policy Rules

| Action | Condition | Effect |
|--------|-----------|--------|
| Auto-adjust calculator defaults | >10 users override same field in 30 days | Allow with A/B test |
| Auto-tune rate model | Override rate >30% for state+item combo | Require approval if >50% |
| Auto-retrain visual primitives | Error rate >10% for drawing type | Allow if <25%; require approval if ≥25% |
| Auto-generate FAQ | >5 similar support chats in 7 days | Allow |
| Auto-tune forecast coefficients | MAPE >20% for project type | Allow if <35%; require approval if ≥35% |

## Quality Gates

1. **Backtest**: New model/fix must outperform baseline on last 20 records
2. **Forward test**: Must show improvement on next 5 records
3. **User acceptance**: For visual primitives, >85% validation rate
4. **Math compliance**: Calculator outputs must pass standards gate
5. **Cost gate**: Token cost increase <20% for same throughput

## Learning Outcomes

When a loop succeeds:
1. Extract pattern into `agent_instincts`
2. Update `skills-lock.json` if skill changed
3. Log success trajectory for future reference
4. If pattern reaches confidence >0.9 and success_count >10, auto-apply without human approval next time

## Failure Handling

When a loop fails quality gate:
1. Log failure with root cause
2. Rollback change if deployed
3. Flag for human review if >3 consecutive failures on same loop_type
4. Add failure pattern to instinct with failure_count++
