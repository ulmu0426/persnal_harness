# Review Gates Reference

Use this reference before final response on non-trivial work.

## Review Report Shape

```yaml
status: accepted | needs_rework | blocked | rejected
changed_files:
scope_check:
goal_contract_check:
overall_completion_score:
score_threshold: 85
passed_threshold:
blocking_gates:
verification_check:
  build:
  lint:
  test:
  run:
  behavior_check:
security_check:
secret_scan_result:
scope_diff_result:
command_audit:
rework_items:
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

## Blocking Gates

Any of these block completion regardless of score:

- schema or required report structure failure when schema validation is part of the task
- changed files outside the agreed scope
- unapproved deletion or revert
- suspected secret or sensitive data exposure
- workspace escape or unsafe symlink target
- unauthorized network, external cost, deployment, or destructive command
- required build, lint, test, run, or behavior check failure
- unresolved data-loss, migration, or security risk

## Rework

Create `rework_items` as concrete next edits, not vague advice.

Good:

- "Add regression test for empty project list in `tests/projects.test.ts`."
- "Restrict the migration to `users.status` and remove unrelated index changes."

Bad:

- "Improve quality."
- "Check edge cases."
