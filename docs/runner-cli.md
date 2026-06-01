# Runner CLI Contract

`harness-runner`는 하네스 정책을 사람이 일관되게 운용할 수 있도록 돕는 명령 계약이다. v1은 dry-run, report recording, audit만 정의한다. 실제 파일 수정, 워커 프로세스 생성, 빌드/린트/테스트/실행 명령 수행은 v1 범위가 아니다.

스킬 배포본에는 전체 `harness-runner` 대신 좁은 보조 감사 스크립트가 포함된다. `skills/local-project-harness/scripts/harness_checks.mjs`는 기존 계약과 보고서를 읽어 scope, secret 후보, close 상태, goal 논리, review 논리, 앱 증거, summary/review 일관성, runner policy sync, README/reference 동기화를 확인한다.

## v1 명령

```text
harness-runner validate --type goal-contract --input <file>
harness-runner validate --type delegation-contract --input <file>
harness-runner validate --type worker-report --input <file>
harness-runner validate --type review-report --input <file>
harness-runner validate --type summary-report --input <file>
harness-runner validate --type lifecycle-event --input <file>
harness-runner validate --type runner-policy --input <file>
harness-runner validate --type run-state --input <file>

harness-runner dry-run --assignment <file>
harness-runner record-report --type worker|review --input <file>
harness-runner audit-close --state <file>
harness-runner audit-scope --assignment <file> --report <file>
harness-runner finalize --state <file>
```

## 비실행 범위

v1 러너는 다음을 하지 않는다.

- 파일 생성, 수정, 삭제
- 빌드, 린트, 테스트, 앱 실행
- 실제 워커 프로세스 또는 외부 에이전트 생성
- 네트워크 호출
- 결제 또는 외부 비용이 발생하는 작업
- 환경 변수 원문, 비밀값, 인증 토큰 출력

## 보조 감사 스크립트

```text
node skills/local-project-harness/scripts/harness_checks.mjs audit-scope --assignment <delegation.json> --report <worker-report.json> [--workspace <path>]
node skills/local-project-harness/scripts/harness_checks.mjs secret-scan <file> [<file> ...]
node skills/local-project-harness/scripts/harness_checks.mjs audit-close --lifecycle-log <events.jsonl>
node skills/local-project-harness/scripts/harness_checks.mjs goal-logic --contract <goal.json>
node skills/local-project-harness/scripts/harness_checks.mjs review-logic --report <review-report.json> --contract <goal.json>
node skills/local-project-harness/scripts/harness_checks.mjs app-evidence --review <review.json>
node skills/local-project-harness/scripts/harness_checks.mjs summary-logic --summary <summary.json> --review <review.json>
```

The installed skill-local runner policy lists only those installed-safe helper audits, using `node scripts/harness_checks.mjs ...` relative to the skill directory. The repo-root runner policy additionally lists repo-maintenance sync checks that require root files:

```text
node skills/local-project-harness/scripts/harness_checks.mjs runner-policy-sync
node skills/local-project-harness/scripts/harness_checks.mjs sync-check --source README.md --copy skills/local-project-harness/references/harness-readme.md
```

`audit-scope` defaults `--workspace` to the current working directory. Existing allowed or changed paths are resolved with realpath so workspace escapes and symlink targets outside the workspace fail. Newly added changed files that do not exist yet are still string-checked and compared as normalized relative paths.

`review-logic` requires `--contract <goal.json>` for accepted/final review auditing; accepted reports fail when the Goal Contract is omitted. Contract-linked reviews must have matching `report.work_type` and `contract.work_type`, and `app_product` in either record triggers app gates. It fails reports missing the full `app_quality_check` key set or required `evidence` array. For `work_type: app_product`, every required app-quality check must be `passed` with non-empty evidence, and the evidence array must include typed desktop, mobile, behavior, accessibility, and state coverage evidence. For non-app work, every required app-quality check must be `not_applicable` with evidence, and the evidence array must exist. Accepted reports must have passed hard gates (`scope_check`, `goal_contract_check`, `security_check`, `secret_scan_result`, `scope_diff_result`); accepted app reports must have passed `run` and `behavior_check`; and accepted `build`, `lint`, or `test` can be `not_applicable` only when evidence says no command, script, check, or harness exists.

`goal-logic` checks app/product Goal Contracts for concrete target users, workflows, content/data/state assumptions, non-happy-path scenario flows, concrete acceptance evidence plans, and blocker-only open questions. App/product classification covers both creation requests and user-facing product-surface improvement requests such as UX improvement, redesign, polish, revamp, modernization, and app UI upgrades; test/docs/config/bugfix/refactor-only maintenance remains non-app when it does not change product surface. `app-evidence` checks app/product review reports for desktop visual evidence, mobile visual evidence, behavior evidence, accessibility evidence, state coverage evidence, and rejects generic or placeholder-only evidence. `summary-logic` compares a Summary Report with its Review Report and fails when the summary hides a non-accepted review, failed or unrun checks, `simulated_same_context` limitations, or runnable access for an accepted `app_product` result. Runnable access must include a concrete dev-server URL, localhost URL, static HTML path, preview URL, or command plus concrete URL/path target.

`runner-policy-sync` compares `harness/runner_policy.yaml` with `skills/local-project-harness/references/policies/runner_policy.yaml`. It allows only expected root-to-skill-local path mappings: root `schemas/<name>.schema.json` equals skill-local `references/schemas/<name>.schema.json`, root helper commands use `node skills/local-project-harness/scripts/harness_checks.mjs`, and installed-skill commands use `node scripts/harness_checks.mjs` from the skill directory. Root-only maintenance helper commands for root-vs-skill runner policy sync and root README/reference sync may be omitted from the installed skill-local helper list; ordinary helper commands, budgets, gates, and other policy values must stay in sync.

이 스크립트는 기존 기록을 감사하는 도구이며, 워커 생성이나 빌드/린트/테스트/실행을 하지 않는다.

## `dry-run`

`dry-run`은 위임 계약을 읽고 다음을 점검한다.

- `task_id`, `objective`, `assigned_scope`, `allowed_files`, `expected_outputs`, `verification` 존재
- `allowed_files`가 워크스페이스 내부의 정규화된 상대 경로인지 여부
- v1 `allowed_files`가 concrete path 목록인지 여부. `*`, `**`, `?`, `[]` 같은 glob 패턴은 v1에서 거부한다.
- 금지 동작에 범위 확장, 기존 변경 되돌리기, 민감 정보 노출 금지가 포함됐는지 여부
- 예산 필드가 기본 한도 안에 있는지 여부
- 보안 게이트가 실패했을 때 작업을 시작하지 않도록 되어 있는지 여부

## `record-report`

`record-report`는 워커 또는 리뷰 보고서를 실행 상태에 연결하는 계약이다. 보고서 원문을 그대로 기록하되 비밀값으로 보이는 문자열은 마스킹 결과만 저장해야 한다.

필수 기록 항목:

- `task_id`
- `report_type`
- `status`
- `changed_files` 또는 `reviewed_outputs`
- `verification` 또는 `verification_check`
- `security_check`
- `secret_scan_result`
- `scope_diff_result`
- `command_audit`
- `budget_used`

## `audit-close`

`audit-close`는 최종 보고 전에 열린 서브에이전트가 남아 있는지 확인한다.

통과 조건:

- 모든 서브에이전트가 `closed`, `blocked`, `validation_failed`, `security_failed`, `budget_exceeded`, `consensus_failed` 중 하나의 종결 상태다.
- `blocked` 상태는 사용자 입력 또는 외부 상태 변경 없이는 진행할 수 없다는 근거가 있다.
- `close_deferred_reason`이 남아 있는 이벤트는 최종화 전에 해소됐다.

## `audit-scope`

`audit-scope`는 위임 계약의 `allowed_files`와 보고서의 `changed_files`를 비교한다. `--workspace <path>`를 지정하지 않으면 현재 작업 디렉터리를 기준으로 realpath와 symlink target을 검사한다.

하드 실패:

- 보고서에 `allowed_files` 밖 변경이 포함됨
- 정규화된 경로가 워크스페이스 밖을 가리킴
- symlink 해석 결과가 워크스페이스 밖을 가리킴
- `allowed_files` 또는 `changed_files`에 glob, 절대 경로, 드라이브 루트, 홈 확장, 환경 변수 확장이 포함됨
- 삭제 또는 되돌리기 작업이 명시 승인 없이 발생함

## `finalize`

`finalize`는 실행 상태를 완료 가능한지 판정하는 dry-run 명령이다.

완료 조건:

- 필수 스키마 검증이 모두 통과
- 보안 게이트 통과
- 리뷰 보고서의 `overall_completion_score`가 `score_threshold` 이상
- `passed_threshold: true`
- `blocking_gates: []`
- close audit 통과
- consensus가 필요한 작업이면 세 역할이 모두 충분하다고 판단

하나라도 실패하면 `finalize`는 `validation_failed`, `security_failed`, `budget_exceeded`, `consensus_failed`, `needs_rework` 중 하나로 종료한다.
