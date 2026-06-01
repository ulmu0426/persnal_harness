# Orchestration Rule

The main session is the orchestrator. It preserves the raw user request, delegates Goal Contract creation to `goal_refiner`, checks only contract completeness, delegates implementation and review work, and makes integration decisions from worker reports and hard gates.

## Flow

```text
user request
  -> goal_refiner creates Goal Contract
  -> main session checks required fields
  -> goal_review_worker reviews contract quality
  -> main session delegates scoped worker tasks
  -> subtask_worker performs assigned work
  -> review_worker or verification_worker reviews outputs
  -> main session reworks from rework_items until accepted or blocked
  -> main session runs schema/security/scope/close/summary checks
  -> summary_worker writes the final Summary Report
  -> main session reports the result to the user
```

## Goal Contract

A full Goal Contract must include:

- `work_type`
- `raw_user_request`
- `concrete_goal`
- `success_criteria`
- `scope_in`
- `scope_out`
- `assumptions`
- `implementation_constraints`
- `quality_score_threshold`
- `scenario_flows`
- `completion_rubric`
- `verification_matrix`
- `acceptance_evidence_plan`
- `iteration_policy`
- `open_questions`
- `delegation_plan_seed`

`verification_matrix` must include `build`, `lint`, `test`, `run`, and `behavior_check`. Each `scenario_flows` item must include `id`, `name`, `actor`, `preconditions`, `steps`, `expected_result`, and `failure_or_edge_cases`.

## App/Product Classification

Requests for an app, site, game, tool, product, bot, extension, timer, widget, or other user-facing product must use `work_type: app_product` unless they are clearly implementation-only maintenance on an existing codebase, such as tests, docs, config, CI, refactors, or bug fixes.

For `work_type: app_product`, the Goal Contract must include `product_brief` and `app_quality_gates`. The product brief must name target users, core problem, primary workflows, domain assumptions, content/data/state assumptions, and non-goals. App-quality gates must cover workflow completeness, visual polish, responsive desktop/mobile behavior, accessibility basics, loading/error/empty states, text overlap and layout stability, domain fit, and evidence requirements.

## Review Gates

`review_worker` scores scenario flows and total completion from 0 to 100. A result can be accepted only when:

- `overall_completion_score >= quality_score_threshold` and at least 85.
- `passed_threshold: true`.
- `blocking_gates` is empty.
- Required `verification_check` gates pass or are explicitly justified as not applicable.
- `app_quality_check` is present; for `app_product`, all required app-quality checks pass with concrete evidence.

Accepted and final reviews must run the contract-linked helper:

```text
node skills/local-project-harness/scripts/harness_checks.mjs review-logic --report <review-report.json> --contract <goal.json>
```

For `app_product`, review evidence must include typed desktop visual, mobile visual, behavior, accessibility, and state coverage entries. Screenshots alone are not enough; behavior and accessibility evidence must describe observed workflow results.

## Completion Checklist

Before work starts:

- Goal Contract has all required fields, including `work_type`.
- App/product requests are classified as `work_type: app_product` unless clearly implementation-only.
- `product_brief` and `app_quality_gates` exist for `app_product`.
- `goal_review_worker` accepted the Goal Contract or all contract rework items were resolved.

Before final response:

- All worker reports were reviewed and consumed.
- Accepted reviews pass `review-logic --report <review-report.json> --contract <goal.json>`.
- App/product reviews include typed app evidence for desktop, mobile, behavior, accessibility, and state coverage.
- Scope, security, secret-scan, schema, summary, and lifecycle close checks are complete or explicitly reported.
- No active sub-agent remains open.
- Remaining risks, unverified checks, and follow-up work are reported to the user.

## Exceptions

The main session may act directly only for blocking relief, small mechanical fixes under five minutes, or security/data-leak prevention. Record the exception type, reason, scope, and follow-up when this happens.
