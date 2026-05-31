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

## Worker Agent

Purpose: implement a bounded slice.

Delegation must include:

- explicit file or module ownership
- inputs and expected outputs
- verification the worker should run
- warning not to revert user or other worker changes

Report:

```yaml
role: worker_agent
status: completed | blocked | needs_review
changed_files:
summary:
verification:
scope_diff_result:
risks_or_follow_up:
```

## Verification Worker

Purpose: independently run checks and inspect behavior without changing implementation.

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

Report:

```yaml
role: review_worker
status: accepted | needs_rework | blocked | rejected
overall_completion_score:
score_threshold: 85
passed_threshold:
blocking_gates:
scope_check:
goal_contract_check:
verification_check:
rework_items:
recommendation:
risks_or_follow_up:
```

## Summary Worker

Purpose: produce the final user-facing summary after all work, verification, review, rework, integration decisions, and lifecycle close audit are complete.

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
