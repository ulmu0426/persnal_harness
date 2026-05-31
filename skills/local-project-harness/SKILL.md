---
name: local-project-harness
description: "Load and apply the README-defined agentic coding harness for local repositories. Use when the user mentions local-project-harness, asks to apply the harness, wants README.md-based orchestration, or wants a main session to operate as an orchestrator with sub-agents, Goal Contracts, delegation, review gates, rework loops, consensus, lifecycle close rules, and final summary_worker reporting."
---

# Local Project Harness

## Source Of Truth

When this skill is triggered, first read `references/harness-readme.md`.

Treat `references/harness-readme.md` as the source of truth for the harness. It is a bundled copy of this project's `README.md` and defines the intended operating model:

- main session as orchestrator
- Goal Contract creation and completeness checks
- task decomposition
- delegation to sub-agents
- worker reports
- review and verification workers
- 85-point completion threshold
- rework loops
- security gates
- consensus for risky work
- lifecycle tracking and close audit
- final integration decision
- final `summary_worker` report using the four required Korean fields defined in `harness-readme.md`

If this `SKILL.md` conflicts with `references/harness-readme.md`, follow `references/harness-readme.md`.

## Required Behavior

After reading `references/harness-readme.md`, run the session according to that harness.

For non-trivial project work:

1. Preserve the raw user request.
2. Create or delegate a Goal Contract before implementation.
3. Confirm the Goal Contract has the required fields and verification matrix.
4. Break work into bounded sub-tasks.
5. Delegate to actual sub-agents when available and authorized.
6. If sub-agents are unavailable, simulate the same roles as explicit internal passes.
7. Keep the main session focused on orchestration, integration, report completeness checks, and final decisions.
8. Assign worker scopes with explicit `allowed_files`, prohibited actions, expected outputs, and verification.
9. Use independent review or verification before final completion.
10. Rework from concrete `rework_items` when threshold or hard gates fail.
11. Track and close consumed sub-agents before final response.
12. After all work and prior sub-agent close handling finish, delegate final summarization to `summary_worker`.
13. Report to the user from the Summary Report, including verification, review decision, unresolved risks, and unverified checks.

Keep trivial tasks lightweight. A direct answer, typo fix, narrow one-line change, or low-risk mechanical command may use a compact implicit contract rather than the full flow.

## Sub-Agent Use

Use real sub-agents only when the current environment provides sub-agent tools and the user has requested this harness, orchestration, delegation, or team-style work.

Delegate only bounded tasks that materially advance the goal. Use disjoint write scopes for parallel workers. Do not duplicate the same work across agents.

If actual sub-agents cannot be used, keep the harness shape by running named internal passes:

- `goal_refiner`
- `explorer_agent`
- `worker_agent`
- `verification_worker`
- `review_worker`
- `summary_worker`
- `security_agent`
- `technical_agent`
- `management_agent`

State this limitation only when it affects the work or the user asks.

## References

Load these only as needed after `harness-readme.md`:

- `references/agent-roles.md`: role contracts and report shapes
- `references/goal-contract.md`: compact and full Goal Contract templates
- `references/review-gates.md`: scoring, blocking gates, and rework rules
- `references/lifecycle.md`: sub-agent lifecycle states and close rules
- `references/local-adoption.md`: how to install project-local harness policy files

## Final Response

Keep final responses concise. Include:

- what was changed or decided
- which agents or internal passes were used
- `summary_worker` report fields as defined in `harness-readme.md`
- verification run and result
- review or integration decision
- unverified checks
- remaining risks or rework items

Do not paste the full README, full Goal Contract, or full agent transcripts unless the user asks.
