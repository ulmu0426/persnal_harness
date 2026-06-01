# Orchestration Modes Reference

Use this whenever the harness delegates work, reviews output, or summarizes confidence.

## Modes

`real_subagent_mode` means the environment provides separate sub-agent tools and a role was actually delegated to another agent context.

`simulated_same_context_mode` means the main session performed named role passes in the same context because real sub-agents were unavailable or not authorized.

## Required Records

For each delegated or simulated role, record:

- mode: `real_subagent_mode` or `simulated_same_context_mode`
- role id and task id
- allowed files and prohibited actions
- expected output/report shape
- verification or review responsibility
- report status
- close condition and close state for real sub-agents
- limitations introduced by same-context simulation

## Runtime Category Mapping

When a runtime exposes only default, explorer, and worker agent categories, keep the harness role ID in records and map to the available runtime category:

- `goal_refiner`, `goal_review_worker`, `app_designer`, `game_designer`, `polish_reviewer`, `review_worker`, `summary_worker`, `security_agent`, `technical_agent`, and `management_agent`: default no-edit agent
- `frontend_worker`, `game_engine_worker`, `asset_worker`, `game_asset_worker`, and `subtask_worker`: worker agent with explicit `allowed_files` and disjoint write scope
- `explorer_agent`: explorer agent for read-only codebase questions
- `playtest_worker` and `verification_worker`: explorer or default no-edit agent unless the assignment explicitly owns local verification artifacts, in which case use a worker agent with a narrow output scope

This mapping does not change role contracts. Specialist roles remain schema-valid role IDs, and `subtask_worker` remains the generic implementation fallback.

## Confidence And Wording

Real sub-agent reports may be called independent only when the role ran in a separate agent context with a bounded assignment.

Same-context reports must use:

- `independence: simulated_same_context`
- "internal pass" or "same-context review"
- explicit missing independent checks
- downgraded final confidence when review or verification would normally require independence

Do not say "independent review", "separate verification", or "external reviewer" for simulated passes.

## Stricter Simulated Validation

When using `simulated_same_context_mode`, compensate with stricter evidence:

- run available deterministic checks before subjective review
- cite concrete files, commands, screenshots, or behavior observations
- reject vague evidence such as "looks good"
- keep unresolved limitations visible in review and summary reports
- require real sub-agent review later when the harness or user marks it as a hard gate

## Final Response Disclosure

The final response must disclose whether real sub-agents were used. If reviews were simulated, say that review/verification was performed as same-context internal passes, list unrun independent checks, and avoid overstating confidence.
