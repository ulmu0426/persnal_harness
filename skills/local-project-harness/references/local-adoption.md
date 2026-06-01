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

Use `~/.codex/skills/local-project-harness/` when the user wants the skill globally available across projects.

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
node skills/local-project-harness/scripts/harness_checks.mjs review-logic --report <review-report.json>
node skills/local-project-harness/scripts/harness_checks.mjs sync-check --source README.md --copy skills/local-project-harness/references/harness-readme.md
```

`audit-scope` defaults `--workspace` to the current working directory. Existing allowed or changed paths are resolved with realpath so symlink targets outside the workspace fail; newly added changed files that do not exist yet are still string-checked and compared as normalized relative paths.

`review-logic` enforces app-quality gate consistency, accepted-report hard gates, default rubric score sums, and same-context review limitation disclosure. These checks are audits only. They do not spawn workers, run builds, run tests, or replace review judgment.
