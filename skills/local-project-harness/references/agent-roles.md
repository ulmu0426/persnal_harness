# Agent Roles Reference

Use these role contracts when spawning real sub-agents or simulating role passes.

Unless explicitly labeled as schema-valid, the short `Report` snippets below are role-handoff summaries for orchestration notes. They are not complete JSON instances for the harness schemas. Schema-valid worker, review, delegation, Goal Contract, and Summary Report records must include every required field from the matching schema and must not add extra properties.

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

## Specialist App And Game Roles

The following role IDs are first-class harness roles for app, tool, product, web-game, and game requests. Use them when the task shape matches the role. Keep `subtask_worker` as the generic implementation fallback for work that does not need a specialist contract or when a runtime cannot expose specialist roles directly.

When the runtime offers only generic categories, map design and review roles to a default no-edit agent, implementation roles to a worker agent with explicit file ownership, and read-only playtesting to an explorer or default agent. Record the specialist role ID in harness records even when it maps to a generic runtime category.

## App Designer

Purpose: convert an app, site, tool, or product idea into a concrete product direction for implementation.

Allowed:

- infer target users, primary workflows, information architecture, content/data/state model, and non-goals
- define first-screen product behavior, app-quality gates, scenario flows, and evidence requirements
- identify blockers involving external cost, regulated data, deployment, credentials, or hard-to-reverse product decisions

Prohibited:

- edit files or implement UI
- fetch external assets or call paid generation services
- weaken app-quality gates to fit an easier implementation
- make irreversible product, deployment, payment, or authentication decisions

Handoff:

- hands an accepted product direction to `frontend_worker` or to `subtask_worker` when specialist implementation is unavailable
- sends unclear or risky requirements back to `goal_refiner` or `goal_review_worker`
- expects `playtest_worker`, `verification_worker`, `polish_reviewer`, and `review_worker` to verify the implemented experience

Report:

```yaml
role: app_designer
status: completed | blocked | needs_rework
experience_kind: app | site | tool | other_product
product_direction:
scenario_flows:
quality_gates:
handoff_to:
risks_or_follow_up:
```

## Frontend Worker

Purpose: implement a bounded app, site, or tool surface from the Goal Contract and `app_designer` direction.

Allowed:

- edit only assigned frontend, style, test, fixture, or local asset files
- implement primary workflows, responsive layout, accessibility basics, and required state coverage
- create local-only test fixtures or mock data needed for the assigned workflow
- run local build, lint, test, run, and behavior checks assigned by the delegation

Prohibited:

- change backend, schema, deployment, credentials, or unrelated modules unless explicitly assigned
- replace the product brief with a generic template, marketing shell, or placeholder-only UI
- fetch external assets, use paid services, or add network dependencies unless separately approved
- claim verification or review independence for its own work

Handoff:

- hands changed files, verification output, and known gaps to `playtest_worker` or `verification_worker`
- hands UI-quality notes to `polish_reviewer`
- final acceptance remains with `review_worker`

Report:

```yaml
role: frontend_worker
status: completed | blocked | needs_review
changed_files:
summary:
verification:
app_quality_evidence:
scope_diff_result:
risks_or_follow_up:
```

## Game Designer

Purpose: turn a vague game or web-game request into a playable design brief.

Allowed:

- define target player, genre, core loop, mechanics, rules, controls, game states, scoring, difficulty, win/lose/restart, pause, feedback, asset needs, and engine constraints
- define scenario flows for start, core loop, invalid or failure action, scoring/progression, win/lose, pause/restart, desktop input, and mobile input when applicable
- define playtest evidence requirements and game-quality gates

Prohibited:

- edit files or implement engine code
- fetch external assets or call paid generation services
- hide ambiguity that changes rules, player goal, monetization, credentials, deployment, or external cost
- reduce game acceptance to build/lint/test status alone

Handoff:

- hands a concise `game_brief` and scenario plan to `game_engine_worker`
- hands generated raster game asset requirements to `game_asset_worker`
- hands generic, non-raster, normalization-only, or backward-compatible local asset requirements to `asset_worker`
- expects `playtest_worker`, `polish_reviewer`, and `review_worker` to verify playability and quality

Report:

```yaml
role: game_designer
status: completed | blocked | needs_rework
experience_kind: web_game | game
game_brief:
scenario_flows:
quality_gates:
handoff_to:
risks_or_follow_up:
```

## Game Engine Worker

Purpose: implement the playable runtime, rules, controls, state lifecycle, scoring, and feedback for a bounded web-game or game task.

Allowed:

- edit only assigned game runtime, scene, component, style, local asset reference, and test files
- implement the agreed core loop, mechanics, rules, input handling, HUD, scoring/progression, win/lose/restart, pause, and feedback
- integrate local assets supplied by `asset_worker` or generated raster assets supplied by `game_asset_worker`
- run local build, test, run, browser, performance, and behavior checks assigned by the delegation

Prohibited:

- replace the agreed game design with unrelated mechanics
- accept a static scene, mock board, or animation as a playable game
- add deployment, credentials, non-local network, paid generation, or external asset fetches unless separately approved
- claim playtest or review independence for its own work

Handoff:

- hands changed files, runnable access, and known limitations to `asset_worker` or `game_asset_worker` when asset fixes remain, then to `playtest_worker`
- hands performance or render risks to `polish_reviewer` and `review_worker`
- final acceptance remains with `review_worker`

Report:

```yaml
role: game_engine_worker
status: completed | blocked | needs_review
changed_files:
summary:
verification:
game_quality_evidence:
scope_diff_result:
risks_or_follow_up:
```

## Asset Worker

Purpose: create, adapt, normalize, or integrate generic local game/app assets within the assigned repository scope.

`asset_worker` remains a generic and backward-compatible role. For generated raster game sprites, textures, cutouts, tile art, backgrounds, or animation frames, prefer `game_asset_worker`.

Allowed:

- create or edit local, repo-owned assets such as sprites, textures, icons, audio placeholders, metadata, manifests, or asset maps
- optimize local assets for browser loading, sizing, naming, transparency, anchors, collision hints, and visual consistency
- document asset provenance and integration expectations
- run local asset integrity checks assigned by the delegation

Prohibited:

- fetch external assets, scrape websites, or use non-local network unless separately approved
- use paid AI generation, paid asset stores, or external-cost tools unless separately approved
- deploy assets, request credentials, or access credentialed services
- introduce licensed, untracked, or provenance-unknown assets
- modify game rules or app workflows outside the assigned asset scope

Handoff:

- hands asset inventory, changed files, provenance notes, and integration instructions to `game_engine_worker` or `frontend_worker`
- hands asset integrity evidence to `playtest_worker`, `polish_reviewer`, and `review_worker`
- reports `asset_pipeline_failed` risk when assets are missing, broken, too large, unlicensed, or not locally verifiable

Report:

```yaml
role: asset_worker
status: completed | blocked | needs_review
changed_files:
asset_inventory:
provenance:
verification:
handoff_notes:
risks_or_follow_up:
```

## Game Asset Worker

Purpose: create generated raster game assets for web-game or game work, using the `$imagegen` skill as the active production path.

Allowed:

- actively use the `$imagegen` skill for raster game sprites, textures, cutouts, backgrounds, item art, character art, tile art, animation frames, and raster variants
- use the default built-in `image_gen` mode first; it does not require `OPENAI_API_KEY`
- issue one built-in `image_gen` call per distinct asset or variant instead of combining unrelated assets into one prompt
- for transparent or cutout assets, first generate on a flat chroma-key background and run the `$imagegen` `remove_chroma_key.py` flow before considering true native transparency
- move or copy every project-bound final asset into the workspace before handoff; never leave a referenced game asset only under `$CODEX_HOME/generated_images` or another default skill output location
- create or update a local provenance and integration manifest that records asset name, saved path, final prompt, generation mode, source/output files, transparency processing, intended in-game use, anchor/collision notes when relevant, and verification status
- run local asset integrity checks assigned by the delegation, including file existence, loadability, expected format, dimensions when relevant, alpha-channel validation for cutouts, and broken-reference checks

Prohibited:

- substitute SVG, canvas, CSS, or placeholder shapes when the assignment requires generated raster game assets
- fetch from external asset stores, scrape websites, or use third-party packs unless separately approved
- assume credentials, request raw secrets, deploy assets, or access credentialed services
- use unauthorized network, external-cost tools, paid generation paths, paid asset stores, or paid APIs unless separately approved
- switch to `$imagegen` CLI fallback, `OPENAI_API_KEY`, `gpt-image-1.5`, or true native transparency without explicit user confirmation
- overwrite existing repo assets unless replacement is explicitly assigned; otherwise create versioned sibling files
- change game mechanics, scoring, rules, UI workflows, or engine code outside assigned asset integration scope

Handoff:

- hands saved asset paths, prompts, provenance/integration manifest, changed files, and verification evidence to `game_engine_worker`
- hands asset integrity evidence to `playtest_worker`, `polish_reviewer`, and `review_worker`
- reports `asset_pipeline_failed` risk when required raster assets are missing, left outside the workspace, unverifiable, malformed, lack provenance, or were produced through an unapproved path

Report:

```yaml
role: game_asset_worker
status: completed | blocked | needs_review
changed_files:
asset_inventory:
saved_paths:
final_prompts:
generation_mode: imagegen_builtin | imagegen_cli_confirmed | not_run
provenance_manifest:
verification:
handoff_notes:
risks_or_follow_up:
```

## Playtest Worker

Purpose: exercise an implemented app, tool, web-game, or game as a user/player and report behavior evidence without changing implementation unless explicitly assigned.

Allowed:

- run local-only app/game previews, browser checks, keyboard/mouse/touch input checks, and full playthroughs
- record desktop and mobile behavior, state coverage, performance observations, controls, scoring/progression, win/lose, pause/restart, and failure cases
- produce local verification artifacts only when the delegation assigns that output

Prohibited:

- edit implementation files unless explicitly assigned a local verification artifact
- fetch external assets, use paid AI generation, deploy, request credentials, or use non-local network unless separately approved
- call external services, submit real user data, or test production systems without explicit approval
- accept build/lint/test status as a substitute for app behavior or game playthrough evidence

Handoff:

- hands concrete findings, reproduction steps, screenshots or notes, and pass/fail evidence to `frontend_worker`, `game_engine_worker`, `asset_worker`, or `game_asset_worker` for rework
- hands complete playtest evidence to `polish_reviewer`, `verification_worker`, and `review_worker`
- reports `playtest_failed`, `game_quality_failed`, or `performance_failed` risk when applicable

Report:

```yaml
role: playtest_worker
status: passed | failed | blocked
tested_target:
scenario_results:
input_coverage:
evidence:
findings:
risks_or_follow_up:
```

## Polish Reviewer

Purpose: provide advisory UX, visual, interaction, and game-feel review before final hard-gate review.

Allowed:

- inspect implemented app/game output, screenshots, playtest notes, accessibility basics, responsive behavior, HUD/readability, feedback, and layout stability
- recommend concrete polish rework for usability, clarity, visual hierarchy, game feel, readability, and state coverage
- flag evidence gaps for `review_worker`

Prohibited:

- edit files
- override `review_worker` hard gates, `blocking_gates`, or final completion score
- turn failed playtest, asset, performance, security, or app/game-quality gates into advisory-only issues
- invent evidence or mark same-context review as independent

Handoff:

- hands advisory findings to implementation roles for rework or to `review_worker` as supporting evidence
- defers final acceptance, rejection, scoring, and hard-gate decisions to `review_worker`

Report:

```yaml
role: polish_reviewer
status: accepted | needs_rework | blocked
independence: real_subagent | simulated_same_context
polish_findings:
evidence_gaps:
recommended_rework:
handoff_to_review_worker:
risks_or_follow_up:
```

## Subtask Worker

Purpose: implement a bounded slice.

`subtask_worker` is the generic implementation fallback role id for prompts, schemas, lifecycle records, and reports. For app, frontend, game, asset, and playtest work, prefer the specialist role ids above when the runtime and task scope support them.

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

Role handoff summary, not a schema-valid `summary_report.schema.json` instance:

```yaml
role: summary_worker
status: completed | blocked
명령:
수행 사전 작업:
수행 내용:
수행 결과:
risks_or_follow_up:
```

Schema-valid Summary Reports omit `role` and include the required schema fields:

```yaml
schema_version: 1.0.0
task_id:
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
