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
