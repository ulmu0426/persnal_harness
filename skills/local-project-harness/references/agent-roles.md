# Agent Roles Reference

Use these role contracts when spawning real sub-agents or simulating role passes.

## Goal Refiner

Purpose: convert the raw request into an implementable Goal Contract.

Allowed:

- inspect the user request and repository context
- infer concrete goal, scope, success criteria, assumptions, verification
- identify blocking questions

Prohibited:

- edit files
- implement features
- review final outputs
- make irreversible product decisions

Report:

```yaml
role: goal_refiner
status: completed | blocked
goal_contract:
  work_type:
risks_or_follow_up:
```

## Explorer Agent

Purpose: answer a specific codebase question quickly.

Good explorer tasks:

- "Find where auth middleware is wired and list files involved."
- "Identify test command and existing test style for this module."
- "Map data flow from API route to persistence layer."

Bad explorer tasks:

- "Understand the whole repo."
- "Find bugs generally."
- "Implement the feature."

Report:

```yaml
role: explorer_agent
status: completed | blocked
answer:
evidence:
relevant_files:
risks_or_follow_up:
```

## Goal Review Worker

Purpose: review the Goal Contract before implementation so poor requirements do not pass only because required fields exist.

Checks:

- concrete goal is implementable and testable
- success criteria are observable
- scope in/out is clear enough for delegation
- assumptions are safe or called out
- `verification_matrix` uses real project checks where possible
- `scenario_flows` cover primary behavior and meaningful failure cases
- `open_questions` contains only real blockers
- for `work_type: app_product`, reject generic product briefs and require target users, core problem, primary workflows, domain assumptions, content/data model assumptions that include state assumptions, and non-goals
- for `work_type: app_product`, scenario flows cover the first usable screen, happy path, empty/loading/error or validation states, responsive desktop/mobile behavior, and at least one domain edge case
- for `work_type: app_product`, `app_quality_gates` require UX workflow completeness, visual polish, responsive desktop/mobile, accessibility basics, loading/error/empty states, text overlap/layout stability, domain fit, and concrete screenshot or manual behavior evidence
- review mode is disclosed as `real_subagent` or `simulated_same_context`, and simulated reviews list missing independent checks

Prohibited:

- edit files
- implement features
- replace the goal_refiner's authorship
- invent user decisions

Report:

```yaml
role: goal_review_worker
status: accepted | needs_rework | blocked | rejected
independence: real_subagent | simulated_same_context
findings:
rework_items:
blocking_questions:
recommendation:
```

## Subtask Worker

Purpose: implement a bounded slice.

`subtask_worker` is the canonical implementation role id for prompts, schemas, lifecycle records, and reports.

For app/product tasks, implement the assigned workflow as a usable product surface, not a placeholder, generic template, or marketing shell. Respect the `product_brief`, domain data model, and state assumptions. Put the primary workflow on the first usable screen, include assigned empty/loading/error/success or validation states, keep desktop and mobile layouts stable, avoid text overlap, and gather the assigned screenshot or manual behavior evidence when verification asks for it.

Delegation must include:

- explicit file or module ownership
- inputs and expected outputs
- verification the worker should run
- warning not to revert user or other worker changes

Report:

```yaml
role: subtask_worker
status: completed | blocked | needs_review
changed_files:
summary:
verification:
scope_diff_result:
risks_or_follow_up:
```

## Verification Worker

Purpose: run checks and inspect behavior without changing implementation. When assigned to a real sub-agent, this is an independent verification pass; when simulated in the main context, report `independence: simulated_same_context` and do not call it independent.

For app/product work, verification must include available deterministic commands plus concrete UX evidence: desktop view, mobile view, primary workflow behavior, accessibility basics, and state coverage. If screenshot tooling, browser access, or a state is impossible, keep the report schema-valid with `not_run` or a failed gate plus a concrete reason instead of silently omitting it.

Report:

```yaml
role: verification_worker
status: passed | failed | blocked
verification_check:
  build:
  lint:
  test:
  run:
  behavior_check:
command_audit:
findings:
```

## Review Worker

Purpose: judge whether the integrated result satisfies the Goal Contract.

For app/product work, accept only when every app-quality key has concrete evidence and the product is usable on the first screen for the target workflow. Build/lint/test success is insufficient by itself. Reject generic "looks good" evidence, placeholder-only UI, missing state coverage, missing responsive evidence, or same-context review that is described as independent.

Report:

```yaml
task_id:
work_type: code_change | docs | schema_policy | app_product | research | other
status: accepted | rejected | needs_rework | blocked | validation_failed | security_failed | budget_exceeded | consensus_failed
reviewed_outputs:
scope_check:
goal_contract_check:
overall_completion_score:
rubric_scores:
scenario_flow_scores:
score_threshold: 85
passed_threshold:
blocking_gates:
verification_check:
app_quality_check:
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

For non-app work, `app_quality_check` is required with `not_applicable` statuses. For app/product work, each check must cite passed evidence or create concrete `rework_items`; do not accept a product UI on generic build/lint/test success alone, and do not accept `not_run` app-quality evidence. If any `scenario_flow_scores[].passed === false`, add `scenario_flow_failed` to `blocking_gates`, set `passed_threshold: false`, use a non-accepted `status` and `recommendation`, and provide concrete `rework_items` unless the report is `blocked` or `rejected`.

## Summary Worker

Purpose: produce the final user-facing summary after all work, verification, review, rework, integration decisions, and lifecycle close audit are complete.

For app/product work, summarize the actual product outcome, UX evidence gathered, runnable URL or static path, and any unverified desktop/mobile/accessibility/state checks. Disclose whether review and verification used real sub-agents or same-context internal passes, and do not raise confidence beyond the recorded review mode.

Allowed:

- read the raw user request, Goal Contract, delegation records, worker reports, verification reports, review reports, rework history, hard gate status, command audit, and lifecycle close status
- organize already completed work into a concise Summary Report

Prohibited:

- edit files
- run new implementation work
- re-score review results
- change the integration decision
- hide failed or unrun verification
- invent evidence not present in prior reports

Report:

```yaml
role: summary_worker
status: completed | blocked
명령:
수행 사전 작업:
수행 내용:
수행 결과:
risks_or_follow_up:
```

The four Korean report keys are required:

- `명령`: original user request and final concrete goal
- `수행 사전 작업`: Goal Contract, scoping, delegation plan, verification plan, and preliminary investigation performed before changes
- `수행 내용`: implementation, verification, review, rework, consensus, and lifecycle-close actions performed by each agent
- `수행 결과`: final integration decision, verification outcome, completion status, unverified items, remaining risks, and follow-up recommendations

## Consensus Roles

Use for high-risk work.

`security_agent` checks:

- secret exposure
- unsafe paths or symlinks
- destructive actions
- unauthorized network or external cost
- permission and data-loss risk

`technical_agent` checks:

- architecture fit
- maintainability
- integration risk
- test adequacy
- schema or API consistency

`management_agent` checks:

- user goal fit
- scope discipline
- delivery readiness
- unresolved decisions
- whether follow-up is required

Each consensus role reports:

```yaml
role:
status: accepted | needs_rework | blocked | rejected
hard_gates:
findings:
rework_items:
recommendation:
```
