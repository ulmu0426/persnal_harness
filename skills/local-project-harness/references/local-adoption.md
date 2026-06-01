# Local Adoption Reference

Use this when adding the harness to a specific local repository.

## Recommended Layout

Prefer project-local files when the harness should travel with the repository:

```text
.codex/
  harness.md
  harness/
    project-policy.yaml
    task-template.md
    review-template.md
```

Use a global skill path when the user wants this harness available across many repositories:

- `$CODEX_HOME/skills/local-project-harness/` when `CODEX_HOME` is set
- `~/.codex/skills/local-project-harness/` when `CODEX_HOME` is unset

Use project-local policy files when the repository needs its own commands, protected paths, or reporting rules. Keep those files under the repo's `.codex/` directory and do not duplicate the whole global skill unless the project intentionally vendors a custom copy.

## `.codex/harness/project-policy.yaml`

```yaml
project:
  name:
  default_branch:
  package_manager:

commands:
  build:
  lint:
  test:
  run:
  behavior_check:

scope_policy:
  require_allowed_files_for_multifile_changes: true
  protect_paths:
    - .env
    - .env.*
    - secrets/
    - credentials/
  allow_destructive_changes_only_when_explicit: true

verification_policy:
  require_tests_for_behavior_changes: true
  allow_not_run_with_reason: true

reporting_policy:
  include_changed_files: true
  include_verification: true
  include_risks: true
```

## `.codex/harness.md`

Keep this short. It should tell Codex:

- use the local project harness for coding work
- read `project-policy.yaml` before edits
- define scope and verification before non-trivial changes
- run relevant commands before final response
- report unverified checks and rework items

## CLI Hardening Later

Add a runner only when manual discipline is not enough. Implement in this order:

1. schema validation for contracts and reports
2. git diff versus `allowed_files`
3. secret scan
4. command audit log
5. lifecycle audit
6. final gate that fails on blocking gates

## Built-In Audit Helper

Before a full runner exists, use `scripts/harness_checks.mjs` for narrow local checks when matching records are available:

```text
node skills/local-project-harness/scripts/harness_checks.mjs audit-scope --assignment <delegation.json> --report <worker-report.json> [--workspace <path>]
node skills/local-project-harness/scripts/harness_checks.mjs secret-scan <file> [<file> ...]
node skills/local-project-harness/scripts/harness_checks.mjs audit-close --lifecycle-log <events.jsonl>
node skills/local-project-harness/scripts/harness_checks.mjs goal-logic --contract <goal.json>
node skills/local-project-harness/scripts/harness_checks.mjs review-logic --report <review-report.json> --contract <goal.json>
node skills/local-project-harness/scripts/harness_checks.mjs app-evidence --review <review.json>
node skills/local-project-harness/scripts/harness_checks.mjs summary-logic --summary <summary.json> --review <review.json>
```

Those command strings are repo-root form for ordinary helper audits. In an installed global skill, run from the skill directory or use the installed skill path and map the helper command to `node scripts/harness_checks.mjs ...`. The skill-local runner policy uses that installed form and intentionally lists only installed-safe helper audits.

The repo-root runner policy additionally lists maintenance sync checks that require root files and are intentionally omitted from the installed skill-local helper list:

```text
node skills/local-project-harness/scripts/harness_checks.mjs runner-policy-sync
node skills/local-project-harness/scripts/harness_checks.mjs sync-check --source README.md --copy skills/local-project-harness/references/harness-readme.md
```

For installed global skill use, run the same script from the installed skill path, for example:

```text
node %CODEX_HOME%/skills/local-project-harness/scripts/harness_checks.mjs review-logic --report <review-report.json> --contract <goal.json>
node ~/.codex/skills/local-project-harness/scripts/harness_checks.mjs app-evidence --review <review.json>
```

Installed skill copies include `references/schemas/` for all core schemas, including `run_state.schema.json` and `runner_policy.schema.json`, plus `references/policies/runner_policy.yaml` as the skill-local runner policy copy. Use those bundled paths when the repository root `schemas/` or `harness/runner_policy.yaml` files are unavailable.

For project-local adoption, prefer committing the skill or a small wrapper under `.codex/` and point to that repository-local path so every collaborator runs the same helper version.

`audit-scope` defaults `--workspace` to the current working directory. Existing allowed or changed paths are resolved with realpath so symlink targets outside the workspace fail; newly added changed files that do not exist yet are still string-checked and compared as normalized relative paths.

`goal-logic` checks app/product Goal Contracts for concrete target users, workflows, content/data/state assumptions, non-happy-path scenario flows, concrete acceptance evidence plans, and blocker-only open questions. It treats user-facing UX, redesign, polish, revamp, modernization, and app UI upgrade requests as `app_product` unless they are clearly implementation-only maintenance.

`review-logic` enforces app-quality gate consistency, accepted-report hard gates, default rubric score sums, same-context review limitation disclosure, and minimum accepted app/product evidence depth. Accepted/final reviews require `--contract <goal.json>` so report and contract `work_type` must match.

`app-evidence` checks app/product review reports for desktop visual evidence, mobile visual evidence, behavior evidence, accessibility evidence, state coverage evidence, and rejects generic or placeholder-only evidence.

`summary-logic` compares a Summary Report with its Review Report and fails when the summary hides a non-accepted review, failed or unrun checks, `simulated_same_context` limitations, or concrete runnable access for an accepted `app_product` result.

`runner-policy-sync` compares root and skill-local runner policies while allowing only expected root-to-skill-local path mappings: root `schemas/<name>.schema.json` to skill-local `references/schemas/<name>.schema.json` and root helper `skills/local-project-harness/scripts/harness_checks.mjs` to installed-skill helper `scripts/harness_checks.mjs`. It allows only the repo-root maintenance helper commands for root-vs-skill runner policy sync and root README/reference sync to be omitted from the installed skill-local helper list; other helper command, budget, gate, and policy drift fails.

These checks are audits only. They do not spawn workers, run builds, run tests, or replace review judgment.
