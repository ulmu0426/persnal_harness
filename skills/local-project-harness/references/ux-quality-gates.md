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

## Required Evidence Types

Review reports for accepted app/product work must include evidence for every app-quality key plus these evidence types:

- `screenshot` or `responsive_check` evidence whose description clearly names the desktop viewport or artifact
- `screenshot` or `responsive_check` evidence whose description clearly names the mobile viewport or artifact
- `manual_behavior_check` or `automated_test` evidence for the primary workflow
- `accessibility_check` evidence for accessibility basics
- `manual_behavior_check` or `automated_test` evidence for state coverage, naming the empty, loading, error, success, disabled, or validation states that were checked

If an evidence type is impossible, keep the report schema-valid by using `status: not_run` or an app-quality gate failure with a concrete reason and blocking rework. A missing dev server, absent browser tooling, or static-only artifact can be a reason for adapting evidence, not for accepting no evidence.

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

## Evidence Wording

Good evidence is concrete:

- "Desktop 1440x900 screenshot inspected: board, filters, and detail drawer visible; no overlap."
- "Mobile 390x844 screenshot inspected: bottom actions wrap into icon toolbar; primary action remains reachable."
- "Behavior check: created a transaction, saw category totals update, then triggered invalid amount validation."

Bad evidence is generic:

- "Looks polished."
- "Responsive design added."
- "Accessibility considered."
