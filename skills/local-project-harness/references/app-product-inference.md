# App Product Inference Reference

Use this when a user asks for an app, site, game, tool, dashboard, product, or other user-facing experience from a vague idea.

## Goal

Convert the request into a concrete `work_type: app_product` Goal Contract without over-questioning. Ask only when no safe default exists for cost, regulated data, destructive actions, deployment, authentication, payments, or a hard-to-reverse product choice.

Add `experience_kind` when the category affects routing or quality gates:

- `app`: workflow-focused application surface
- `site`: content or brand site with a first-viewport product, place, person, or offer signal
- `tool`: input/output utility or creation surface
- `web_game`: browser-playable game
- `game`: game work that may include broader game runtime assumptions
- `other_product`: user-facing product experience that does not fit the other labels

## Product Brief Requirements

Reject briefs that could describe any app. A usable `product_brief` must include:

- `target_users`: who uses it, their context, and what they are trying to finish
- `core_problem`: the specific job the product solves
- `primary_workflows`: 1-3 workflows the first usable version must support
- `domain_assumptions`: domain rules, vocabulary, tone, constraints, and likely edge cases
- `content_data_model_assumptions`: entities, fields, relationships, sample records, status values, validation, and empty data
- `non_goals`: excluded integrations, admin surfaces, marketing pages, auth, persistence, analytics, or advanced automation

## Game Brief Requirements

For `experience_kind: web_game` or `game`, include `game_brief` with:

- `target_player`: player type, context, device expectations, and session length
- `genre`: familiar category and constraints
- `core_loop`: repeated player action, challenge, reward, and progression
- `mechanics`: movement, collision, puzzle, combat, resource, timing, AI, or physics behavior
- `rules`: valid and invalid actions, boundaries, penalties, and success conditions
- `controls`: desktop and mobile input model when applicable
- `states`: start, playing, pause, win, lose, restart, transition, loading, and error or missing-asset states
- `win_lose_restart`: how a run ends, advances, retries, or resets
- `difficulty_progression`: level curve, speed, hazards, randomness, or tutorial ramp
- `scoring`: points, timer, health, combo, progress, stars, or unlocks
- `feedback`: HUD, animation, sound placeholder, hit/collect/invalid action feedback, and game feel
- `assets`: local-only asset needs, placeholders, provenance, and integrity checks
- `engine_constraints`: browser target, engine/library choice, performance budget, and device constraints

## First Usable Screen

The first screen should be the product, not a landing page, unless the user explicitly asks for marketing. It must expose the primary workflow immediately:

- task apps show the working list, editor, board, timeline, or dashboard
- games show playable state and controls
- tools show the input, output, and core controls
- dashboards show real domain metrics, filters, and drillable or inspectable records
- sites for a brand, venue, portfolio, or product show the subject as the first-viewport signal

## Data Model Inference

Infer enough structure to make the UI feel real. Define:

- core entities and fields
- record lifecycle states
- validation or constraints
- example records with domain-specific labels
- empty, loading, error, and success states
- persistence boundary, such as local state only, local storage, mocked API, or existing backend

## Scenario Flows

Every app/product contract needs scenario flows covering:

- primary happy path from first screen to completed outcome
- empty or first-run state
- loading or long-running state when applicable
- error or invalid input state
- responsive desktop and mobile interaction
- one meaningful domain edge case

Game scenario flows additionally need coverage for:

- start or first playable state
- one complete core-loop cycle
- invalid, blocked, missed, or failure action
- scoring, health, timer, progress, or level change
- win, lose, or completion condition
- pause and restart
- desktop input
- mobile input when applicable

## Evidence Plan

Acceptance evidence must name concrete artifacts or checks:

- desktop screenshot or visual inspection
- mobile screenshot or visual inspection
- behavior check for the primary workflow
- accessibility basics check
- state coverage for empty/loading/error/success or a reason a state is impossible
- layout stability and text-overlap check

Game evidence must also name:

- local runnable target and browser/device used
- full playthrough or complete-loop playtest notes
- controls/input coverage for desktop and mobile when applicable
- rules and invalid-action behavior
- scoring/progression and win/lose/restart state coverage
- performance or render stability check
- asset integrity and missing-asset check

## Compact Examples

Vague: "Build a budget app."

Strong contract direction: target users are solo renters tracking monthly cash flow; workflows are add expense, compare category spend to budget, and review upcoming bills; entities are account, transaction, category, budget, bill; states include empty month, over-budget warning, invalid amount, and saved transaction; non-goals exclude bank sync and multi-user sharing.

Vague: "Make a puzzle game."

Strong contract direction: target users are casual desktop/mobile players; first screen is a playable board with score, moves, reset, and level picker; entities are puzzle, tile, move, timer, score; states include new game, invalid move, solved, paused, and small-screen controls; non-goals exclude online leaderboards and account profiles.

Vague: "Create a CRM dashboard."

Strong contract direction: target users are sales managers reviewing pipeline health; workflows are filter opportunities, inspect account risk, and update deal stage; entities are account, contact, opportunity, activity, owner; states include no matches, stale activity warning, loading records, and failed update; non-goals exclude email sync and billing.
