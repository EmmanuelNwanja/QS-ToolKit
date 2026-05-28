# QSToolkit Agent Skills

This directory contains specialized agent skill configurations for the QSToolkit platform.

## Skill Registry

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `qs-calculator-constants` | Nigerian QS constants, unit conversions, material standards | Any calculator or BOQ math operation |
| `qs-rate-intelligence` | Historical rate aggregation, market trend detection, suggestion generation | Rate suggestion, rate override detection |
| `qs-visual-primitives` | Architectural drawing analysis with spatial markers | Drawing upload, Auto-BOQ generation |
| `qs-math-validation` | BOQ math gate, calculator standards gate, cross-document consistency | Before BOQ save, invoice generation, calculator output |
| `qs-self-improvement` | Sensor events, policy enforcement, learning loops, instinct extraction | Background cron, anomaly detection |

## Usage

Skills are loaded on-demand by the AI Engine based on the query type. Each skill is a self-contained module that can be:
- Embedded into Dr. Q prompts
- Used by specialist agents (BoqAgent, RateAgent, ForecastAgent)
- Referenced in the `skills-lock.json` for version tracking

## Adding a New Skill

1. Create a new file in this directory
2. Define the skill's prompt template, parameters, and validation rules
3. Add an entry to `skills-lock.json`
4. Update this README
