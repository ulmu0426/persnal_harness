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
experience_kind: app | site | tool | web_game | game | other_product
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
game_brief:
  target_player:
  genre:
  core_loop:
  mechanics:
  rules:
  controls:
  states:
  win_lose_restart:
  difficulty_progression:
  scoring:
  feedback:
  assets:
  engine_constraints:
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
- `experience_kind` is optional and should be present when `work_type: app_product` needs product-category routing or gates. Allowed values are `app`, `site`, `tool`, `web_game`, `game`, and `other_product`.
- `product_brief` and `app_quality_gates` are optional for ordinary code, docs, schema, and research work.
- If the request is for creating or improving an app, site, game, tool, UX, UI, landing page, dashboard, checkout, or other product experience, set `work_type: app_product` unless it is clearly only non-product implementation work such as tests, docs, config, bugfix, refactor, dependency, schema, policy, lint, or CI maintenance.
- If `work_type: app_product`, include `product_brief` and `app_quality_gates`; do not make every small non-product coding task use them.
- If `experience_kind: web_game` or `game`, include `game_brief` unless the request is explicitly only non-game maintenance. The schema keeps `game_brief` optional for backward compatibility, but goal review treats it as required for complete game work.
- For vague app/product requests, infer a product brief instead of questioning the user by default:
  - `target_users`: likely users, context, skill level, and job-to-be-done.
  - `core_problem`: the specific user problem the app must solve.
  - `primary_workflows`: the main actions a user must complete on the first usable version, especially on the first screen.
  - `domain_assumptions`: domain rules, constraints, vocabulary, edge cases, and tone inferred from the request and repo.
  - `content_data_model_assumptions`: likely entities, fields, relationships, sample data, validation, persistence boundary, and state assumptions such as empty, loading, error, success, disabled, validation, and domain lifecycle states.
  - `non_goals`: tempting extras, marketing pages, broad platform work, integrations, or admin features outside the first usable product.
- For vague game requests, infer a `game_brief` instead of asking broad preference questions by default:
  - `target_player`: who will play, their likely device context, and expected session length.
  - `genre`: the familiar game category and any useful constraints.
  - `core_loop`: what the player repeatedly does, why it is fun or challenging, and how a session progresses.
  - `mechanics` and `rules`: player actions, valid/invalid actions, collisions, physics, AI, resource rules, timing, or puzzle logic.
  - `controls`: keyboard, mouse, touch, gamepad, or mobile input requirements.
  - `states`: start, playing, paused, failed, won, lost, restarted, level transition, and error or asset-loading states.
  - `win_lose_restart`: how the player wins, loses, retries, restarts, or advances.
  - `difficulty_progression`: level curve, speed, hazards, scoring pressure, randomness, or tutorial ramp.
  - `scoring` and `feedback`: score, progress, combo, timer, health, audio/visual/haptic-style feedback, and HUD updates.
  - `assets`: local-only sprites, models, textures, audio placeholders, UI art, and provenance expectations.
  - `engine_constraints`: browser target, framework or engine choice, performance budget, save model, and device constraints.
- Reject generic `product_brief` values. "Users manage items", "simple dashboard", "modern UI", or "improve productivity" is not enough without domain workflow, content/data model assumptions that include states, and non-goals.
- Ask only for blockers with no safe default, such as external payments, regulated data handling, destructive data changes, production deployment, or a product decision that would be hard to reverse.
- For app/product work, `success_criteria`, `scenario_flows`, `verification_matrix`, and `acceptance_evidence_plan` must cover UX workflow completion, visual polish, responsive desktop/mobile behavior, accessibility basics, loading/error/empty states, text overlap and layout stability, domain fit, and screenshots or manual behavior checks when applicable.
- For game/web-game work, `success_criteria`, `scenario_flows`, `verification_matrix`, and `acceptance_evidence_plan` must cover a playable core loop, rules clarity, controls and input coverage, game state lifecycle, difficulty/progression, scoring, feedback/game feel, HUD/readability, performance/render stability, asset integrity, browser/mobile playability, and full playthrough evidence.
- Reject `scenario_flows` that include only a happy path. Require at least one meaningful edge or failure case per primary workflow, plus empty or first-run behavior when relevant.
- Reject game `scenario_flows` that do not cover start, core loop, invalid/failure action, scoring/progression, win/lose, pause/restart, desktop input, and mobile input when applicable.
- Reject weak `acceptance_evidence_plan` entries such as "manual check", "looks good", or "test in browser". Evidence plans must name the expected artifact or check, including desktop/mobile visual evidence, primary workflow behavior, accessibility basics, state coverage, and any impossible checks with reasons.
- For games, reject evidence plans that rely only on build/lint/test. They must include a local runnable target, input checks, at least one full playthrough or complete loop playtest, state transitions, performance/render stability, and asset integrity evidence.

After field completeness passes, send the contract to `goal_review_worker`. Do not start implementation until the goal review is `accepted` or the review's concrete `rework_items` have been resolved.
