# Goal Contract Reference

Use this reference when the task is ambiguous, multi-file, risky, or likely to need review/rework.

## Compact Contract

```yaml
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
raw_user_request:
concrete_goal:
success_criteria:
scope_in:
scope_out:
assumptions:
implementation_constraints:
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
