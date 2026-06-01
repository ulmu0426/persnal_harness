# Goal Contract Reference

Use this reference when the task is ambiguous, multi-file, risky, or likely to need review/rework.

## Compact Contract

```yaml
work_type:
raw_user_request:
concrete_goal:
success_criteria:
scope_in:
scope_out:
allowed_files:
assumptions:
implementation_constraints:
verification_matrix:
  build:
  lint:
  test:
  run:
  behavior_check:
open_questions:
```

## Full Contract

Use the full form for larger features, migrations, security-sensitive changes, or tasks that will be split across workers.

```yaml
work_type: code_change | docs | schema_policy | app_product | research | other
raw_user_request:
concrete_goal:
success_criteria:
scope_in:
scope_out:
assumptions:
implementation_constraints:
product_brief:
  target_users:
  core_problem:
  primary_workflows:
  domain_assumptions:
  content_data_model_assumptions:
  non_goals:
app_quality_gates:
  ux_workflow_completeness:
  visual_polish:
  responsive_desktop_mobile:
  accessibility_basics:
  error_loading_empty_states:
  text_overlap_layout_stability:
  domain_fit:
  evidence_requirements:
quality_score_threshold: 85
scenario_flows:
  - id:
    name:
    actor:
    preconditions:
    steps:
    expected_result:
    failure_or_edge_cases:
completion_rubric:
  question_fulfillment: 25
  functional_completeness: 20
  scenario_flow_coverage: 30
  edge_case_handling: 10
  regression_safety: 5
  verification_completeness: 10
verification_matrix:
  build:
  lint:
  test:
  run:
  behavior_check:
acceptance_evidence_plan:
iteration_policy:
open_questions:
delegation_plan_seed:
```

## Rules

- Keep `raw_user_request` faithful to the user's words.
- Make `concrete_goal` implementable and testable.
- Put only intended edits in `scope_in`.
- Put tempting but unrelated work in `scope_out`.
- Use `open_questions` only for real blockers: security risk, data loss, external cost, irreversible product decision, or missing required input.
- Prefer safe assumptions for ordinary ambiguity and record them.
- Define verification in terms of this repository's real commands.
- `work_type` is required in full/non-trivial Goal Contracts. Compact trivial task notes can stay lightweight, but canonical contracts must classify the work.
- `product_brief` and `app_quality_gates` are optional for ordinary code, docs, schema, and research work.
- If the request is for an app, site, game, tool, or product experience, set `work_type: app_product` unless it is clearly only non-product implementation work.
- If `work_type: app_product`, include `product_brief` and `app_quality_gates`; do not make every small non-product coding task use them.
- For vague app/product requests, infer a product brief instead of questioning the user by default:
  - `target_users`: likely users and their context.
  - `core_problem`: the user problem the app must solve.
  - `primary_workflows`: the main actions a user must complete on the first usable version.
  - `domain_assumptions`: domain rules, constraints, and tone inferred from the request and repo.
  - `content_data_model_assumptions`: likely entities, fields, states, and sample data expectations.
  - `non_goals`: tempting extras, marketing pages, broad platform work, integrations, or admin features outside the first usable product.
- Ask only for blockers with no safe default, such as external payments, regulated data handling, destructive data changes, production deployment, or a product decision that would be hard to reverse.
- For app/product work, `success_criteria`, `scenario_flows`, `verification_matrix`, and `acceptance_evidence_plan` must cover UX workflow completion, visual polish, responsive desktop/mobile behavior, accessibility basics, loading/error/empty states, text overlap and layout stability, domain fit, and screenshots or manual behavior checks when applicable.

After field completeness passes, send the contract to `goal_review_worker`. Do not start implementation until the goal review is `accepted` or the review's concrete `rework_items` have been resolved.
