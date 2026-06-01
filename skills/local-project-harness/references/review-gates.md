# Review Gates Reference

Use this reference before final response on non-trivial work.

## Review Report Shape

```yaml
task_id:
work_type: code_change | docs | schema_policy | app_product | research | other
status: accepted | rejected | needs_rework | blocked | validation_failed | security_failed | budget_exceeded | consensus_failed
reviewed_outputs:
scope_check:
goal_contract_check:
overall_completion_score:
rubric_scores:
  question_fulfillment:
  functional_completeness:
  scenario_flow_coverage:
  edge_case_handling:
  regression_safety:
  verification_completeness:
scenario_flow_scores:
score_threshold: 85
passed_threshold:
blocking_gates:
verification_check:
  build:
  lint:
  test:
  run:
  behavior_check:
app_quality_check:
  ux_workflow_completeness:
  visual_polish:
  responsive_desktop_mobile:
  accessibility_basics:
  error_loading_empty_states:
  text_overlap_layout_stability:
  domain_fit:
  evidence:
security_check:
secret_scan_result:
scope_diff_result:
command_audit:
budget_used:
independence: real_subagent | simulated_same_context
rework_items:
next_iteration_recommendation:
risks_or_follow_up:
recommendation:
```

## Scoring

Default weights:

- `question_fulfillment`: 25
- `functional_completeness`: 20
- `scenario_flow_coverage`: 30
- `edge_case_handling`: 10
- `regression_safety`: 5
- `verification_completeness`: 10

Use exact scoring only for large or high-risk tasks. For normal tasks, make a concise judgment:

- `accepted`: clearly satisfies the request, scoped correctly, verified enough
- `needs_rework`: known gap is fixable in the current turn
- `blocked`: cannot proceed without user input or external state
- `rejected`: approach is wrong or unsafe and should not be integrated

For `work_type: app_product`, the score must include app-quality evidence, not only build/lint/test status. Review UX workflow completeness, visual polish, responsive desktop/mobile behavior, accessibility basics, loading/error/empty states, text overlap and layout stability, domain fit, and the requested screenshot or manual behavior evidence. For non-app work, set every `app_quality_check` item to `not_applicable` with a short reason.

## Blocking Gates

Any of these block completion regardless of score:

- schema or required report structure failure when schema validation is part of the task
- changed files outside the agreed scope
- unapproved deletion or revert
- suspected secret or sensitive data exposure
- workspace escape or unsafe symlink target
- unauthorized network, external cost, deployment, or destructive command
- required build, lint, test, run, or behavior check failure
- any `scenario_flow_scores[].passed === false`; add `scenario_flow_failed`, set `passed_threshold: false`, use a non-accepted `status` and `recommendation`, and provide concrete `rework_items` unless the report is `blocked` or `rejected`
- failed required app-quality check for `work_type: app_product`
- unresolved data-loss, migration, or security risk

## Logical Consistency

Review reports must be internally consistent:

- `accepted` requires `passed_threshold: true`, `blocking_gates: []`, and `overall_completion_score >= score_threshold`.
- Any `blocking_gates` entry requires `passed_threshold: false` and a non-accepted `status` and `recommendation`.
- `passed_threshold: false` requires concrete `rework_items` unless the status is `blocked` or `rejected`.
- `app_quality_check` must be present in every review report with all required check keys: `ux_workflow_completeness`, `visual_polish`, `responsive_desktop_mobile`, `accessibility_basics`, `error_loading_empty_states`, `text_overlap_layout_stability`, and `domain_fit`.
- `app_quality_check.evidence` must be present as an array.
- An accepted report must not contain failed verification, app-quality, security, scope, or secret checks.
- For `work_type: app_product`, every required app-quality check must be `passed` with non-empty evidence, and `app_quality_check.evidence` must include at least one `passed` item with a non-empty `description` or `artifact`.
- Any failed required verification should appear in `blocking_gates`.
- Any failed scenario flow score must add `scenario_flow_failed` to `blocking_gates`; a failed scenario flow requires `passed_threshold: false`, a non-accepted `status` and `recommendation`, and concrete `rework_items` unless the status is `blocked` or `rejected`.
- Any failed app-quality check must add `app_quality_failed` to `blocking_gates`; `app_quality_failed` requires at least one failed or not-run app-quality item with evidence explaining the gap.
- When all six default rubric entries use integer scores and max-score weights, `overall_completion_score` must match their score sum.
- For non-app work, every required app-quality check must be present and marked `not_applicable` with evidence; `app_quality_check.evidence` must exist and may use `not_applicable`.
- A same-context internal pass must set `independence: simulated_same_context` and report the missing independent review in `risks_or_follow_up` or a similar limitations field.

## Rework

Create `rework_items` as concrete next edits, not vague advice.

Good:

- "Add regression test for empty project list in `tests/projects.test.ts`."
- "Restrict the migration to `users.status` and remove unrelated index changes."

Bad:

- "Improve quality."
- "Check edge cases."
