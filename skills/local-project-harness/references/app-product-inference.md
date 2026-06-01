# App Product Inference Reference

Use this when a user asks for an app, site, game, tool, dashboard, product, or other user-facing experience from a vague idea.

## Goal

Convert the request into a concrete `work_type: app_product` Goal Contract without over-questioning. Ask only when no safe default exists for cost, regulated data, destructive actions, deployment, authentication, payments, or a hard-to-reverse product choice.

## Product Brief Requirements

Reject briefs that could describe any app. A usable `product_brief` must include:

- `target_users`: who uses it, their context, and what they are trying to finish
- `core_problem`: the specific job the product solves
- `primary_workflows`: 1-3 workflows the first usable version must support
- `domain_assumptions`: domain rules, vocabulary, tone, constraints, and likely edge cases
- `content_data_model_assumptions`: entities, fields, relationships, sample records, status values, validation, and empty data
- `non_goals`: excluded integrations, admin surfaces, marketing pages, auth, persistence, analytics, or advanced automation

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

## Evidence Plan

Acceptance evidence must name concrete artifacts or checks:

- desktop screenshot or visual inspection
- mobile screenshot or visual inspection
- behavior check for the primary workflow
- accessibility basics check
- state coverage for empty/loading/error/success or a reason a state is impossible
- layout stability and text-overlap check

## Compact Examples

Vague: "Build a budget app."

Strong contract direction: target users are solo renters tracking monthly cash flow; workflows are add expense, compare category spend to budget, and review upcoming bills; entities are account, transaction, category, budget, bill; states include empty month, over-budget warning, invalid amount, and saved transaction; non-goals exclude bank sync and multi-user sharing.

Vague: "Make a puzzle game."

Strong contract direction: target users are casual desktop/mobile players; first screen is a playable board with score, moves, reset, and level picker; entities are puzzle, tile, move, timer, score; states include new game, invalid move, solved, paused, and small-screen controls; non-goals exclude online leaderboards and account profiles.

Vague: "Create a CRM dashboard."

Strong contract direction: target users are sales managers reviewing pipeline health; workflows are filter opportunities, inspect account risk, and update deal stage; entities are account, contact, opportunity, activity, owner; states include no matches, stale activity warning, loading records, and failed update; non-goals exclude email sync and billing.
