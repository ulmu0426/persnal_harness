# Agentic Coding Harness

## App/Product Quality Gates

For vague app or product requests, the harness should not pester the user for broad product clarification. `goal_refiner` infers a practical product brief and records safe assumptions. It asks only for true blockers with no safe default, such as external cost, regulated or destructive data handling, production deployment, or an irreversible product decision.

For `work_type: app_product`, the Goal Contract includes:

- `product_brief.target_users`
- `product_brief.core_problem`
- `product_brief.primary_workflows`
- `product_brief.domain_assumptions`
- `product_brief.content_data_model_assumptions`
- `product_brief.non_goals`
- `app_quality_gates.ux_workflow_completeness`
- `app_quality_gates.visual_polish`
- `app_quality_gates.responsive_desktop_mobile`
- `app_quality_gates.accessibility_basics`
- `app_quality_gates.error_loading_empty_states`
- `app_quality_gates.text_overlap_layout_stability`
- `app_quality_gates.domain_fit`
- `app_quality_gates.evidence_requirements`

App/product acceptance evidence should cover real user workflows, desktop and mobile behavior, basic accessibility, loading/error/empty states, text overlap and layout stability, and domain-appropriate presentation. Use screenshots, responsive checks, accessibility checks, automated tests, or manual behavior checks when applicable. Non-app coding, docs, schema, and research tasks stay lightweight; their review reports still include `app_quality_check`, but every item is `not_applicable`.

`goal_refiner` must classify app, site, game, tool, and product-experience requests as `work_type: app_product` unless they are clearly only non-product implementation work. `goal_review_worker` must reject or request rework for an `app_product` Goal Contract that lacks the product brief, primary workflows, app-quality gates, or evidence plan. `review_worker` must not accept an app/product result on build/lint/test status alone. Failed, not-run, or inapplicable required app-quality checks add `app_quality_failed` to `blocking_gates` and produce concrete `rework_items`.

This harness is a minimal operating framework that prevents the main session from directly doing coding work by default. Instead, it forces goal refinement and bounded subtasks to be delegated to workers. Its purpose is to clearly separate user request concretization, Goal Contract completeness checks, work breakdown, delegation, progress tracking, review delegation, and review-report-based integration decisions so the main session does not drift into being the goal analyst, implementer, and reviewer at the same time.

## Core Principles

- The main session is the orchestrator.
- When a user request arrives, the main session does not analyze the goal content directly; it delegates Goal Contract creation to `goal_refiner`.
- The main session checks only whether the Goal Contract has all required fields. It does not directly judge the substance of the goal or review the produced output.
- When the Goal Contract fields are complete, a separate `goal_review_worker` reviews the content quality for implementability, testability, scope, assumptions, and verification plan.
- The main session performs only Goal-Contract-based work breakdown, delegation, progress tracking, review delegation, review report completeness checks, and integration decisions.
- Work that can be delegated as an independent subtask, such as feature implementation, test updates, refactoring, or research writeups, is performed by workers.
- For non-trivial app/product work, real output review is a hard gate performed by a separate `review_worker` or `verification_worker` when real sub-agent tools are available.
- `review_worker` scores scenario flows and overall completion from 0 to 100. By default, a result must score at least 85 before it can be recommended for integration.
- If the completion score is below 85, or if a required scenario or verification gate fails, the main session repeats implementation and review delegation based on the review report's `rework_items`.
- The main session tracks every sub-agent lifecycle and closes a sub-agent as soon as its report has been consumed.
- After all work, review, rework, integration decisions, and previous sub-agent close handling are complete, the main session delegates final summarization to `summary_worker` immediately before reporting to the user.
- `summary_worker` does not perform new work or evaluate outputs. It writes a Summary Report from completed orchestration records using the required fields `명령`, `수행 사전 작업`, `수행 내용`, and `수행 결과`.
- If real sub-agents are unavailable and review is simulated in the same context, the report is not independent review. Mark it as `independence: simulated_same_context`, lower the final confidence, and explicitly list missing independent checks.
- Split all work into the smallest practical subtasks, and give each worker clear inputs, scope, outputs, and prohibited actions.
- A worker handles only its delegated scope and reports anything unclear or out of scope back to the main session.

## Directory Layout

```text
.
|-- README.md
|-- docs/
|   |-- consensus-protocol.md
|   |-- lifecycle-log.md
|   |-- orchestration-rule.md
|   |-- runner-cli.md
|   |-- schema-validation.md
|   `-- security-gates.md
|-- examples/
|   |-- goal_contract.valid.json
|   |-- delegation_contract.valid.json
|   |-- lifecycle_log.jsonl
|   |-- review_report.valid.json
|   |-- worker_report.valid.json
|   |-- summary_report.valid.json
|   `-- task_breakdown.md
|-- harness/
|   |-- orchestration_policy.yaml
|   `-- runner_policy.yaml
|-- prompts/
|   |-- main_orchestrator.md
|   `-- subtask_worker.md
`-- schemas/
    |-- delegation_contract.schema.json
    |-- goal_contract.schema.json
    |-- lifecycle_event.schema.json
    |-- review_report.schema.json
    |-- run_state.schema.json
    |-- runner_policy.schema.json
    |-- summary_report.schema.json
    `-- worker_report.schema.json
```

## Quick Usage

1. Load `harness/orchestration_policy.yaml` as policy input in the runtime or agent configuration.
2. Apply `prompts/main_orchestrator.md` to the main session as a system or developer prompt.
3. Use `prompts/subtask_worker.md` as the worker prompt when starting a subtask.
4. When a real work request arrives, the main session passes the raw request to `goal_refiner` and delegates Goal Contract creation.
5. The main session checks only that the Goal Contract has all required fields and that `verification_matrix` includes `build`, `lint`, `test`, `run`, and `behavior_check`.
6. A separate `goal_review_worker` reviews the Goal Contract's content quality. If it reports `needs_rework`, `blocked`, or `rejected`, resolve the revision or user input before breaking down the work.
7. The main session breaks the Goal Contract into independent subtasks and assigns scope and expected outputs to each worker.
8. After receiving worker results, the main session delegates review to a separate `review_worker` or `verification_worker` when real sub-agent tools are available.
9. `review_worker` writes a review report that includes completion score, scenario-flow scores, threshold status, and rework items.
10. If the completion score is below 85 or a required gate fails, the main session re-delegates work based on `rework_items`. If the score is at least 85 and required gates pass, it makes the integration decision.
11. When a sub-agent report has been consumed as input to the next stage, the main session closes that sub-agent.
12. After all work is complete, the main session delegates final summarization to `summary_worker` and closes `summary_worker` after consuming the Summary Report.
13. Until a real runner is implemented, commands in `docs/runner-cli.md` are treated only as dry-run, record, and audit contracts.

## Required Goal Contract Fields

A Goal Contract must include the following 16 fields. The main session checks only field presence; content quality is reviewed separately.

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

## Completion Scoring

The default passing threshold is `quality_score_threshold: 85`. `review_worker` sums the following axes to a 100-point score.

- `question_fulfillment`: how well the original request intent is satisfied
- `functional_completeness`: completeness of the functional scope
- `scenario_flow_coverage`: coverage of key scenario flows
- `edge_case_handling`: handling of exceptions and failure cases
- `regression_safety`: preservation of existing behavior
- `verification_completeness`: sufficiency of verification evidence

`scenario_flows` define user or system flows step by step. Each flow includes `id`, `name`, `actor`, `preconditions`, `steps`, `expected_result`, and `failure_or_edge_cases`. A review report must include `task_id`, `work_type`, `status`, `reviewed_outputs`, `scope_check`, `goal_contract_check`, `overall_completion_score`, `rubric_scores`, `scenario_flow_scores`, `score_threshold`, `passed_threshold`, `blocking_gates`, `verification_check`, `app_quality_check`, `security_check`, `secret_scan_result`, `scope_diff_result`, `command_audit`, `budget_used`, `independence`, `rework_items`, `next_iteration_recommendation`, `risks_or_follow_up`, and `recommendation`.

## Main Session Role

The main session performs only the following tasks.

- Receive the user request: preserve the raw request and pass it to `goal_refiner`.
- Check Goal Contract completeness: verify only that required fields and required verification items exist at a meta level.
- Break down work: split the Goal Contract into independently executable subtasks.
- Delegate: pass inputs, scope, outputs, prohibited actions, and verification methods to each worker.
- Track progress: record which tasks are in progress, completed, blocked, or awaiting review.
- Delegate review: assign output review to `review_worker` or `verification_worker`.
- Check review report completeness: verify at a meta level that required items, verification results, risks, and recommendations are present.
- Re-delegate based on threshold: if `passed_threshold` is false, delegate `rework_items` as new subtasks.
- Track sub-agent lifecycle: record `agent_id`, `role`, `task_id`, `status`, and `close_condition`.
- Close consumed sub-agents: when a report has been consumed as orchestration input, close the corresponding sub-agent.
- Decide integration: based on review reports, decide whether to merge, rework, or delegate additional work.
- Delegate final summary: after all work and previous sub-agent close handling are complete, delegate Summary Report creation to `summary_worker`.
- Report to the user: use the `summary_worker` Summary Report as the basis for the final user report.

## Worker Roles

Workers perform the delegated subtasks.

- `goal_refiner` converts an abstract user request into an implementable Goal Contract.
- Workers operate only within assigned files, modules, docs, and test scope.
- Workers do not make out-of-scope changes, delete files, or revert existing work.
- Workers report their results and verification method to the main session.
- If blocked, workers report the blocker clearly instead of proceeding by guesswork.

`goal_refiner` concretizes abstract requests with reasonable assumptions by default, without asking the user follow-up questions. It records blocking questions in `open_questions` only when there is no safe default, such as security risk, data loss, external cost, or an irreversible product decision.

`goal_review_worker` reviews whether the Goal Contract is sufficient before implementation. It checks an implementable and testable `concrete_goal`, observable `success_criteria`, clear `scope_in` and `scope_out`, safe `assumptions`, a `verification_matrix` that matches real project commands or checks, `scenario_flows` that include important success and failure paths, and `open_questions` that contain only real blockers. `goal_review_worker` does not edit files or implement work; it reports one of `accepted`, `needs_rework`, `blocked`, or `rejected` with concrete `rework_items`.

`review_worker` or `verification_worker` reviews outputs and worker reports and writes a review report. For non-trivial app/product work, this review is an independent hard gate when real sub-agent tools are available. A same-context internal pass must not be called independent review. The main session does not directly evaluate output substance; it checks that the review report is complete and policy-compatible.

If the completion score is below 85, `review_worker` reports `needs_rework` with concrete `rework_items`. The main session does not adjust the score directly; it delegates those items as new implementation work.

Review reports must be logically consistent. `accepted` is allowed only when `passed_threshold: true`, `blocking_gates` is empty, and `overall_completion_score >= score_threshold`. If any `blocking_gates` entry exists, the report must use `passed_threshold: false` and a non-accepted status. If `passed_threshold: false` and the status is not `blocked` or `rejected`, concrete `rework_items` must be present. `accepted` reports must not contain failed verification, app-quality, security, scope, or secret checks.

`summary_worker` runs only after all implementation, verification, review, rework, integration decisions, and previous sub-agent close handling are complete. `summary_worker` does not modify files or re-evaluate outputs; it reads the completed Goal Contract, delegation records, worker reports, review reports, verification results, rework history, hard gate status, and close status, then writes only the final Summary Report. The Summary Report must include the following four fields.

- `명령`: the original user request and the concrete goal finalized by the main session
- `수행 사전 작업`: preparation before actual changes, such as Goal Contract creation, scoping, delegation planning, verification planning, and preliminary investigation
- `수행 내용`: which sub-agent handled which task, and what implementation, verification, review, rework, consensus, and close handling occurred
- `수행 결과`: final integration decision, verification outcome, completion status, unverified items, remaining risks, and follow-up recommendations

The main session checks only Summary Report format completeness and does not ask `summary_worker` to recalculate completed review scores or integration decisions. `summary_worker` is also subject to close audit and must be closed after its Summary Report is consumed as final user-report input.

## Schema Validation And Runner Policy

The v1 harness does not implement a real execution runner. Instead, `schemas/` and `harness/runner_policy.yaml` define fixed structures for the Goal Contract, delegation contract, worker report, review report, Summary Report, lifecycle event, and run state.

The runner contract is limited to the following scope.

- `validate`: JSON Schema based structural validation
- `dry-run`: preflight checks for delegation contract scope, budget, and security gates
- `record-report`: record worker and review reports
- `audit-close`: check whether open sub-agents remain before final reporting
- `audit-scope`: compare `allowed_files` with actual changed files
- `finalize`: check whether schema, security, score, close audit, and consensus requirements passed

The v1 runner does not modify files, directly run build/lint/test/run commands, spawn worker processes, or perform network/external-cost work. If Ajv-based validation is implemented later, dependencies must be pinned in `package.json` and the lockfile. Running unpinned `npx` is not accepted as standard harness validation.

The skill distribution may include the optional local audit script `skills/local-project-harness/scripts/harness_checks.mjs`. This script does not run the harness. It checks `allowed_files` versus report change scope, secret candidates, lifecycle close state, review report logical consistency, goal contract logical consistency, app acceptance evidence, and summary/review consistency. The repo-root runner policy also lists repo-maintenance sync checks for runner policy synchronization and synchronization between root `README.md` and bundled `references/harness-readme.md`; the installed skill-local runner policy omits those root-only maintenance commands and lists only helper audits that are meaningful from the installed skill directory.

`runner-policy-sync` compares `harness/runner_policy.yaml` with `skills/local-project-harness/references/policies/runner_policy.yaml` while treating root `schemas/<name>.schema.json` paths as equivalent to skill-local `references/schemas/<name>.schema.json` paths and root helper path `skills/local-project-harness/scripts/harness_checks.mjs` as equivalent to installed-skill helper path `scripts/harness_checks.mjs`. It allows only the repo-root maintenance helper commands for root-vs-skill runner policy sync and root README/reference sync to be omitted from the skill-local helper list; other command, budget, gate, and policy drift fails. `audit-scope --workspace <path>` defaults to the current working directory, realpath-checks existing allowed or changed paths, rejects workspace escapes and symlink targets outside the workspace, and keeps non-existing newly added files on normalized relative-path comparison. `review-logic --report <review-report.json> --contract <goal.json>` is required for accepted/final review auditing; accepted reports fail when the Goal Contract is omitted. It rejects contract-linked review reports whose `work_type` differs from the Goal Contract; rejects accepted reports unless hard gates (`scope_check`, `goal_contract_check`, `security_check`, `secret_scan_result`, `scope_diff_result`) are passed; rejects accepted `app_product` reports unless app-quality, typed app evidence, `run`, and `behavior_check` are passed; enforces `app_quality_failed`; checks default rubric score sums when practical; and requires `simulated_same_context` limitations to be recorded. `goal-logic` checks goal contracts, including product-surface improvement requests such as UX work, redesign, polish, revamp, modernization, and app UI upgrades that must be `app_product` unless they are clearly implementation-only maintenance. `app-evidence` checks review report app evidence, and `summary-logic` checks summary reports against review reports and requires accepted `app_product` summaries to disclose concrete runnable access.

In v1, `allowed_files` and `changed_files` allow only concrete workspace-relative paths. Absolute paths, drive roots, `..`, home or environment variable expansion, and glob patterns are rejected.

## Security Gates And Consensus Protocol

The following are hard gates that block integration and finalization regardless of score.

- `validation_failed`: schema or required report structure validation failed
- `security_failed`: secret exposure, workspace escape, symlink policy violation, unauthorized network/cost, or out-of-scope change
- `budget_exceeded`: iteration, rework, sub-agent, or wall-clock budget exceeded
- `consensus_failed`: security, technical, and management roles failed to reach agreement

Changes that strengthen the harness itself or require security/technical/management judgment are discussed sequentially by `security_agent`, `technical_agent`, and `management_agent`. If consensus is reached, a separate implementation worker runs the change, and all three roles read and evaluate the result again. If any role reports a hard gate or a score below 85, the loop repeats based on `rework_items`.

Three-role consensus uses 2 rounds by default and at most 3 rounds. Destructive changes, network/external cost, deployment, broad filesystem scope, and runner/security/schema/lifecycle/budget policy changes are high-risk consensus triggers.

The default iteration budget is intentionally generous for small highly automated work.

```yaml
max_iterations: 8
max_rework_iterations: 6
max_consensus_rounds: 3
max_subagents_per_task: 16
max_open_subagents: 6
max_validation_failures: 3
max_wall_clock_minutes: 180
min_completion_score: 85
```

## Sub-Agent Lifecycle

Sub-agents remain open only while needed. The default policy is to close a sub-agent immediately after its report has been consumed by the next orchestration step.

```text
spawned
  -> assigned
  -> running
  -> report_received
  -> consumed
  -> close_pending
  -> closed
```

Required close points:

- immediately after the `goal_refiner` Goal Contract is used for main-session completeness checking
- immediately after a `subtask_worker` Worker Report is consumed as review or verification input
- immediately after a `review_worker` Review Worker Report is consumed for integration, re-delegation, or completion decision
- immediately after a `verification_worker` Verification Report is consumed for review or integration decision
- immediately after a `summary_worker` Summary Report is consumed as final user-report input
- when a blocked sub-agent will not be reused immediately
- immediately before the final user report

Close may be deferred only when the same sub-agent must receive immediate follow-up input and preserving context is clearly useful. In that case, record `close_deferred_reason`. No open sub-agent should remain before the final response.

## Simple Execution Flow

```text
user request
  -> goal_refiner: concretize the abstract request into a Goal Contract
  -> main session: check required Goal Contract fields
  -> main session: create subtask list from the Goal Contract
  -> main session: assign worker tasks
  -> worker: perform implementation, investigation, testing, documentation, or other real work
  -> worker: report changes and verification results
  -> main session: delegate output review to a review worker
  -> review_worker: review output, score scenario flows, and calculate overall completion score
  -> main session: check review report completeness
  -> main session: if below 85, re-delegate based on rework_items
  -> main session: if score is at least 85 and required gates pass, integrate or report completion
  -> main session: close consumed sub-agents
  -> summary_worker: summarize using 명령 / 수행 사전 작업 / 수행 내용 / 수행 결과
  -> main session: consume Summary Report and close summary_worker
  -> main session: send final user report from the Summary Report
```

## Exception Handling

The main session normally does not directly perform subtasks. It may do limited direct work only under the following conditions.

- Urgent blocker relief: worker execution itself is blocked and cannot continue without a short immediate action.
- Mechanical fix under five minutes: a typo, path name, obvious formatting error, or similar change that requires almost no judgment.
- Security or data-leak prevention: secret exposure, dangerous commands, or sensitive information spread must be stopped immediately.

When using an exception, the main session must record what it did directly, why the exception was necessary, and whether follow-up delegation is required.
