# Runner CLI Contract

`harness-runner`는 하네스 정책을 사람이 일관되게 운용할 수 있도록 돕는 명령 계약이다. v1은 dry-run, report recording, audit만 정의한다. 실제 파일 수정, 워커 프로세스 생성, 빌드/린트/테스트/실행 명령 수행은 v1 범위가 아니다.

스킬 배포본에는 전체 `harness-runner` 대신 좁은 보조 감사 스크립트가 포함된다. `skills/local-project-harness/scripts/harness_checks.mjs`는 기존 계약과 보고서를 읽어 scope, secret 후보, close 상태, review 논리, README/reference 동기화만 확인한다.

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
node skills/local-project-harness/scripts/harness_checks.mjs review-logic --report <review-report.json>
node skills/local-project-harness/scripts/harness_checks.mjs sync-check --source README.md --copy skills/local-project-harness/references/harness-readme.md
```

`audit-scope` defaults `--workspace` to the current working directory. Existing allowed or changed paths are resolved with realpath so workspace escapes and symlink targets outside the workspace fail. Newly added changed files that do not exist yet are still string-checked and compared as normalized relative paths.

`review-logic` fails reports missing the full `app_quality_check` key set or the required `evidence` array. For `work_type: app_product`, every required app-quality check must be `passed` with non-empty evidence, and the evidence array must include at least one passed item with a non-empty description or artifact. For non-app work, every required app-quality check must be `not_applicable` with evidence, and the evidence array must exist. The command still fails accepted reports that contain failed verification, app-quality, security, scope, secret, or scenario-flow checks, enforces `app_quality_failed` and `scenario_flow_failed` consistency, checks default rubric score sums when practical, and requires disclosure of `simulated_same_context` review limitations.

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
