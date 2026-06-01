# UX Quality Gates Reference

Use this for `work_type: app_product` goal review, implementation review, verification, and rework.

## Pass/Fail Gates

An app/product output is not accepted unless all applicable gates pass with evidence:

- `primary_workflow_first_screen`: the first screen exposes the main workflow; no placeholder-only UI or marketing shell unless explicitly requested
- `workflow_completion`: the primary scenario can be completed end to end
- `domain_fit`: labels, data, interactions, and tone fit the inferred domain and target user
- `visual_polish`: spacing, hierarchy, contrast, and component states look deliberate; reject bland/generic UIs that could describe any app
- `responsive_desktop_mobile`: desktop and mobile layouts are usable and visually stable
- `text_overlap_layout_stability`: no clipped labels, overlapping text, unstable controls, or viewport-width font hacks
- `accessibility_basics`: semantic controls, keyboard-reachable workflow, visible focus, labels, alt text where needed, and acceptable contrast
- `state_coverage`: empty, loading, error, success, disabled, and validation states exist when applicable
- `behavior_evidence`: primary interactions were manually checked or covered by tests
- `runnable_access`: final response reports a runnable local URL, dev server URL, or static file path

## Review Schema Mapping

The conceptual gates above guide review, but the review-report schema accepts only these app-quality keys under `app_quality_check`: `ux_workflow_completeness`, `visual_polish`, `responsive_desktop_mobile`, `accessibility_basics`, `error_loading_empty_states`, `text_overlap_layout_stability`, `domain_fit`, and `evidence`. Do not add conceptual gate names as extra `app_quality_check` properties.

Use this mapping when writing schema-valid review reports:

| Conceptual gate | Schema-compatible location |
| --- | --- |
| `primary_workflow_first_screen` | `app_quality_check.ux_workflow_completeness` evidence and, when applicable, `app_quality_check.evidence[]` with screenshot or behavior evidence |
| `workflow_completion` | `app_quality_check.ux_workflow_completeness`, `scenario_flow_scores[]`, and `verification_check.behavior_check` |
| `domain_fit` | `app_quality_check.domain_fit` |
| `visual_polish` | `app_quality_check.visual_polish` |
| `responsive_desktop_mobile` | `app_quality_check.responsive_desktop_mobile` and desktop/mobile `app_quality_check.evidence[]` entries |
| `text_overlap_layout_stability` | `app_quality_check.text_overlap_layout_stability` |
| `accessibility_basics` | `app_quality_check.accessibility_basics` and `app_quality_check.evidence[]` with `type: accessibility_check` |
| `state_coverage` | `app_quality_check.error_loading_empty_states` and `app_quality_check.evidence[]` describing checked empty, loading, error, success, disabled, or validation states |
| `behavior_evidence` | `verification_check.behavior_check` and `app_quality_check.evidence[]` with `type: manual_behavior_check` or `type: automated_test` |
| `runnable_access` | `verification_check.run` evidence and the final Summary Report/user response; it is not a direct `app_quality_check` key |

## Game-Specific Gates

For `experience_kind: web_game` or `game`, these gates apply in addition to app/product UX gates. Build, lint, and test results alone cannot satisfy game acceptance.

- `playable_core_loop`: the player can start, perform the main action loop, receive feedback, and reach progression or resolution
- `rules_clarity`: objectives, valid actions, invalid/failure actions, scoring, and win/lose conditions are understandable from play
- `controls_input_coverage`: desktop controls work, and mobile/touch controls work when the target includes mobile
- `game_state_lifecycle`: start, playing, pause, restart, win, lose, loading, and error or missing-asset states are handled when applicable
- `challenge_difficulty_progression`: challenge ramps or changes intentionally and avoids impossible, trivial, or stalled play
- `feedback_game_feel`: movement, hits, collects, invalid actions, transitions, and scoring produce timely visual/audio-placeholder/HUD feedback
- `hud_readability`: score, health, timer, level, prompts, and status remain readable without covering the playfield
- `performance_render_stability`: canvas/WebGL/animation rendering is nonblank, stable, and responsive at expected desktop and mobile sizes
- `asset_integrity`: required local sprites, textures, models, audio placeholders, and manifests load with known provenance and no broken references; generated raster game assets have workspace-saved paths, final prompts, generation mode, transparency processing notes when applicable, and provenance/integration manifest entries
- `browser_mobile_playability`: the game is playable in the target browser and on the applicable mobile viewport or documented device class
- `full_playthrough_evidence`: a complete loop, level, win/loss, or restart path was actually played through

## Required Evidence Types

Review reports for accepted app/product work must include evidence for every app-quality key plus these evidence types:

- `screenshot` or `responsive_check` evidence whose description clearly names the desktop viewport or artifact
- `screenshot` or `responsive_check` evidence whose description clearly names the mobile viewport or artifact
- `manual_behavior_check` or `automated_test` evidence for the primary workflow
- `accessibility_check` evidence for accessibility basics
- `manual_behavior_check` or `automated_test` evidence for state coverage, naming the empty, loading, error, success, disabled, or validation states that were checked

If an evidence type is impossible, keep the report schema-valid by using `status: not_run` or an app-quality gate failure with a concrete reason and blocking rework. A missing dev server, absent browser tooling, or static-only artifact can be a reason for adapting evidence, not for accepting no evidence.

Accepted game/web-game work must also include concrete playtest or game-quality evidence for playable core loop, rules and invalid action, controls, scoring/progression, win/lose/restart, performance/render stability, asset integrity, and full playthrough. Missing, failed, generic, or not-run game evidence creates `game_quality_failed`, `playtest_failed`, `asset_pipeline_failed`, or `performance_failed` blocking gates as appropriate.

## Rejection Criteria

Reject or require rework when:

- the UI is only placeholder cards, generic lorem ipsum, or a feature list
- the first screen does not let the target user start the primary workflow
- all data is generic and does not express the domain model
- the product has no credible empty, error, or validation state
- desktop or mobile layout has overlap, clipping, unreadable text, or broken controls
- evidence says only "looks good", "manual check passed", or "seems fine"
- build/lint/test passes but no UX behavior or visual evidence exists
- the final answer omits how to run or open the product
- a game is only a static scene, mock board, menu, animation, or asset preview without a playable loop
- rules, scoring, controls, win/lose, pause/restart, or invalid action behavior cannot be exercised
- game assets are broken, externally fetched without approval, missing provenance, left only in default generation output locations, produced through unapproved paid/CLI/network paths, or not locally verifiable
- canvas/WebGL/animation output is blank, unstable, unplayable, or too slow for the target viewport
- no full playthrough or complete-loop playtest evidence exists

## Evidence Wording

Good evidence is concrete:

- "Desktop 1440x900 screenshot inspected: board, filters, and detail drawer visible; no overlap."
- "Mobile 390x844 screenshot inspected: bottom actions wrap into icon toolbar; primary action remains reachable."
- "Behavior check: created a transaction, saw category totals update, then triggered invalid amount validation."

Bad evidence is generic:

- "Looks polished."
- "Responsive design added."
- "Accessibility considered."
