# Agentic Coding Harness

이 하네스는 코딩 작업을 메인 세션이 직접 처리하지 않고, 기본적으로 목표 구체화와 하위 작업을 워커에게 위임하도록 강제하는 최소 운영 골격이다. 목적은 사용자 요청 구체화, Goal Contract 완비성 확인, 작업 분해, 위임, 추적, 검수 위임, 검수 보고서 기반 통합 결정을 명확히 분리해서 메인 세션이 목표 분석자, 구현자, 검수자 역할로 흐르지 않게 만드는 것이다.

## 기본 원칙

- 메인 세션은 오케스트레이터다.
- 사용자 요청이 들어오면 메인 세션은 목표 내용을 직접 분석하지 않고 `goal_refiner`에게 Goal Contract 생성을 위임한다.
- 메인 세션은 Goal Contract의 필수 필드 완비성만 확인하고, 내용의 타당성이나 산출물 검수는 직접 판단하지 않는다.
- 메인 세션은 Goal Contract 기반 작업 분해, 위임, 진행 추적, 검수 위임, 검수 보고서 완비성 확인, 통합 결정만 수행한다.
- 기능 구현, 테스트 수정, 리팩터링, 조사 결과 작성처럼 독립 하위 작업으로 위임 가능한 일은 워커가 수행한다.
- 실제 산출물 검수는 별도 `review_worker` 또는 `verification_worker`가 수행한다.
- `review_worker`는 시나리오 플로우와 종합 완성도를 0~100점으로 평가하고, 기본 기준인 85점 이상을 통과해야 통합 가능하다고 권고할 수 있다.
- 완성도가 85점 미만이거나 필수 시나리오/검증 게이트가 실패하면 메인 세션은 리뷰 보고서의 `rework_items`를 기반으로 구현과 리뷰를 반복 위임한다.
- 메인 세션은 모든 서브에이전트의 수명주기를 추적하고, 보고서가 소비된 서브에이전트는 즉시 close한다.
- 모든 작업은 가능한 한 작은 하위 작업으로 나누고, 각 워커에게 명확한 입력, 범위, 산출물, 금지 사항을 제공한다.
- 워커는 자신에게 위임된 범위만 처리하고, 불명확하거나 범위를 벗어난 내용은 메인 세션에 보고한다.

## 디렉터리 구성

```text
.
├── README.md
├── docs/
│   ├── consensus-protocol.md
│   ├── lifecycle-log.md
│   ├── orchestration-rule.md
│   ├── runner-cli.md
│   ├── schema-validation.md
│   └── security-gates.md
├── examples/
│   ├── goal_contract.valid.json
│   ├── lifecycle_log.jsonl
│   ├── review_report.valid.json
│   └── task_breakdown.md
├── harness/
│   ├── orchestration_policy.yaml
│   └── runner_policy.yaml
├── prompts/
│   ├── main_orchestrator.md
│   └── subtask_worker.md
└── schemas/
    ├── delegation_contract.schema.json
    ├── goal_contract.schema.json
    ├── lifecycle_event.schema.json
    ├── review_report.schema.json
    ├── run_state.schema.json
    ├── runner_policy.schema.json
    └── worker_report.schema.json
```

## 빠른 사용법

1. `harness/orchestration_policy.yaml`을 런타임 또는 에이전트 설정에서 정책 입력으로 로드한다.
2. 메인 세션에는 `prompts/main_orchestrator.md`를 시스템 또는 개발자 프롬프트로 적용한다.
3. 하위 작업을 시작할 때는 `prompts/subtask_worker.md`를 워커 프롬프트로 사용한다.
4. 실제 작업 요청이 들어오면 메인 세션은 요청 원문을 `goal_refiner`에게 넘겨 Goal Contract 생성을 위임한다.
5. 메인 세션은 Goal Contract의 필수 필드와 `verification_matrix`의 `build`, `lint`, `test`, `run`, `behavior_check` 항목 존재만 확인한다.
6. 메인 세션은 Goal Contract를 기반으로 작업을 독립 하위 작업으로 나누고 각 워커에게 범위와 산출물을 지정한다.
7. 워커의 결과를 받은 뒤 메인 세션은 별도 `review_worker` 또는 `verification_worker`에게 검수를 위임한다.
8. `review_worker`는 완성도 점수, 시나리오 플로우 점수, threshold 통과 여부, 재작업 항목을 포함한 검수 보고서를 작성한다.
9. 완성도 85점 미만 또는 필수 게이트 실패 시 메인 세션은 `rework_items`를 기반으로 재위임하고, 85점 이상과 필수 게이트 통과 시 통합 결정을 내린다.
10. 각 서브에이전트 보고서가 다음 단계 입력으로 소비되면 메인 세션은 해당 서브에이전트를 close한다.
11. 실제 러너 구현 전까지 `docs/runner-cli.md`의 명령은 dry-run, record, audit 계약으로만 취급한다.

## Goal Contract 필수 필드

Goal Contract는 다음 15개 필드를 포함해야 한다. 메인 세션은 필드 존재만 확인하고 내용 품질은 직접 판단하지 않는다.

- `raw_user_request`
- `concrete_goal`
- `success_criteria`
- `scope_in`
- `scope_out`
- `assumptions`
- `implementation_constraints`
- `quality_score_threshold`
- `scenario_flows`
- `completion_rubric`
- `verification_matrix`
- `acceptance_evidence_plan`
- `iteration_policy`
- `open_questions`
- `delegation_plan_seed`

## 완성도 평가 기준

기본 통과 기준은 `quality_score_threshold: 85`다. `review_worker`는 다음 평가 축을 100점 만점으로 합산한다.

- `question_fulfillment`: 원 질문 의도 충족도
- `functional_completeness`: 기능 범위 완성도
- `scenario_flow_coverage`: 주요 시나리오 플로우 충족도
- `edge_case_handling`: 예외와 실패 케이스 처리
- `regression_safety`: 기존 동작 보존
- `verification_completeness`: 검증 증거 충분성

`scenario_flows`는 사용자 또는 시스템 플로우를 단계별로 정의한다. 각 플로우는 `id`, `name`, `actor`, `preconditions`, `steps`, `expected_result`, `failure_or_edge_cases`를 포함한다. 리뷰 보고서에는 `overall_completion_score`, `rubric_scores`, `scenario_flow_scores`, `passed_threshold`, `blocking_gates`, `verification_check`, `security_check`, `secret_scan_result`, `scope_diff_result`, `command_audit`, `budget_used`, `rework_items`가 포함되어야 한다.

## 메인 세션 역할

메인 세션은 다음 작업만 수행한다.

- 사용자 요청 접수: 요청 원문을 보존하고 `goal_refiner`에게 전달한다.
- Goal Contract 완비성 확인: 필수 필드와 필수 검증 항목이 있는지만 메타 수준에서 확인한다.
- 작업 분해: Goal Contract를 입력으로 독립적으로 수행 가능한 하위 작업으로 나눈다.
- 위임: 각 워커에게 입력, 범위, 산출물, 금지 사항, 검증 방법을 전달한다.
- 진행 추적: 어떤 작업이 진행 중인지, 완료됐는지, 차단됐는지 기록한다.
- 검수 위임: 산출물 검수를 `review_worker` 또는 `verification_worker`에게 맡긴다.
- 검수 보고서 완비성 확인: 검수 보고서에 필수 항목, 검증 결과, 위험, 권고가 포함됐는지 메타 수준에서 확인한다.
- threshold 기반 재위임: `passed_threshold`가 false이면 `rework_items`를 새 하위 작업으로 위임한다.
- 서브에이전트 라이프사이클 추적: `agent_id`, `role`, `task_id`, `status`, `close_condition`을 기록한다.
- 소비 완료 서브에이전트 close: 보고서가 오케스트레이션 입력으로 소비되면 해당 서브에이전트를 닫는다.
- 통합 결정: 검수 보고서를 기반으로 결과를 병합할지, 재작업할지, 추가 위임할지 판단한다.

## 워커 역할

워커는 위임받은 하위 작업을 실제로 수행한다.

- `goal_refiner`는 추상적인 사용자 요청을 구현 가능한 Goal Contract로 구체화한다.
- 지정된 파일, 모듈, 문서, 테스트 범위 안에서만 작업한다.
- 범위 밖 변경, 삭제, 되돌리기는 하지 않는다.
- 결과와 검증 방법을 메인 세션에 보고한다.
- 차단 사유가 있으면 추측으로 진행하지 않고 명확히 보고한다.

`goal_refiner`는 추상 요청을 기본적으로 사용자에게 되묻지 않고 합리적 가정으로 구체화한다. 단, 보안, 데이터 손실, 외부 비용, 되돌리기 어려운 제품 결정처럼 안전한 기본값이 없는 경우에만 `open_questions`에 차단 질문을 남긴다.

`review_worker` 또는 `verification_worker`는 산출물과 워커 보고서를 독립적으로 검수하고 검수 보고서를 작성한다. 메인 세션은 산출물 내용을 직접 평가하지 않고, 검수 보고서가 완비됐는지와 정책상 통합 가능한 상태인지 확인한다.

완성도 점수가 85점 미만이면 `review_worker`는 `needs_rework`와 구체적인 `rework_items`를 보고한다. 메인 세션은 점수를 직접 조정하지 않고, 해당 항목을 새 구현 작업으로 재위임한다.

## 스키마 검증과 러너 정책

v1 하네스는 실제 실행 러너를 구현하지 않는다. 대신 `schemas/`와 `harness/runner_policy.yaml`로 Goal Contract, 위임 계약, 워커 보고서, 리뷰 보고서, 수명주기 이벤트, 실행 상태의 구조를 고정한다.

러너 계약은 다음 범위로 제한한다.

- `validate`: JSON Schema 기반 구조 검증
- `dry-run`: 위임 계약의 범위, 예산, 보안 게이트 사전 점검
- `record-report`: 워커와 리뷰 보고서 기록
- `audit-close`: 최종 보고 전 열린 서브에이전트가 남아 있는지 확인
- `audit-scope`: `allowed_files`와 실제 변경 파일 범위 비교
- `finalize`: 스키마, 보안, 점수, close audit, consensus 통과 여부 확인

v1 러너는 파일을 수정하거나, build/lint/test/run 명령을 직접 실행하거나, 워커 프로세스를 생성하거나, 네트워크/외부 비용 작업을 수행하지 않는다. 향후 Ajv 기반 검증을 구현할 경우 의존성은 `package.json`과 lockfile에 고정해야 하며, 버전 고정 없는 `npx` 실행은 표준 검증으로 인정하지 않는다.

v1의 `allowed_files`와 `changed_files`는 concrete workspace-relative path만 허용한다. 절대 경로, 드라이브 루트, `..`, 홈/환경 변수 확장, glob 패턴은 거부한다.

## 보안 게이트와 합의 프로토콜

다음은 점수와 관계없이 통합과 최종화를 막는 hard gate다.

- `validation_failed`: 스키마 또는 필수 보고서 구조 검증 실패
- `security_failed`: 비밀값 노출, workspace escape, symlink 정책 위반, 허가 없는 네트워크/비용, 범위 밖 변경
- `budget_exceeded`: 반복, 재작업, 서브에이전트, 시간 예산 초과
- `consensus_failed`: 보안, 기술, 관리 역할이 합의하지 못함

하네스 자체 보강이나 보안/기술/관리 판단이 필요한 변경은 `security_agent`, `technical_agent`, `management_agent`가 순서대로 토론한다. 합의가 성립하면 별도 구현 워커가 실행하고, 세 역할이 결과를 다시 읽고 평가한다. 하나라도 hard gate나 85점 미만 평가를 내면 `rework_items` 기반으로 반복한다.

3역할 합의는 기본 2라운드, 최대 3라운드다. destructive change, 네트워크/외부 비용, 배포, broad filesystem scope, runner/security/schema/lifecycle/budget 정책 변경은 high-risk consensus trigger로 취급한다.

기본 반복 예산은 소규모 고자동화 사용을 전제로 넉넉하게 둔다.

```yaml
max_iterations: 8
max_rework_iterations: 6
max_consensus_rounds: 3
max_subagents_per_task: 16
max_open_subagents: 6
max_validation_failures: 3
max_wall_clock_minutes: 180
min_completion_score: 85
```

## 서브에이전트 라이프사이클

서브에이전트는 필요한 동안만 유지한다. 기본 정책은 보고서가 다음 오케스트레이션 단계에서 소비되면 즉시 close하는 것이다.

```text
spawned
  -> assigned
  -> running
  -> report_received
  -> consumed
  -> close_pending
  -> closed
```

close 필수 시점은 다음과 같다.

- `goal_refiner`의 Goal Contract가 메인 완비성 확인에 사용된 직후
- `subtask_worker`의 Worker Report가 리뷰 또는 검증 위임 입력으로 소비된 직후
- `review_worker`의 Review Worker Report가 통합, 재위임, 완료 결정에 소비된 직후
- `verification_worker`의 Verification Report가 리뷰 또는 통합 결정에 소비된 직후
- `blocked` 상태의 서브에이전트를 즉시 재사용하지 않을 때
- 최종 사용자 보고 직전

같은 서브에이전트에 즉시 후속 입력을 보내야 하고 컨텍스트 유지가 명확히 유리할 때만 close를 지연할 수 있다. 이 경우 `close_deferred_reason`을 기록한다. 최종 응답 전에는 열린 서브에이전트가 남아 있지 않아야 한다.

## 간단한 실행 흐름

```text
사용자 요청
  -> goal_refiner: 추상 요청을 Goal Contract로 구체화
  -> 메인 세션: Goal Contract 필수 필드 완비성 확인
  -> 메인 세션: Goal Contract 기반 하위 작업 목록 작성
  -> 메인 세션: 워커별 작업 위임
  -> 워커: 구현, 조사, 테스트, 문서화 등 실제 작업 수행
  -> 워커: 변경 내용과 검증 결과 보고
  -> 메인 세션: 검수 워커에게 산출물 검수 위임
  -> review_worker: 산출물 검수, 시나리오 플로우 점수화, 종합 완성도 점수 산정
  -> 메인 세션: 검수 보고서 완비성 확인
  -> 메인 세션: 85점 미만이면 rework_items 기반 재위임
  -> 메인 세션: 85점 이상이고 필수 게이트 통과 시 통합 또는 완료 보고
  -> 메인 세션: 소비 완료된 서브에이전트 close
```

## 예외 처리

메인 세션은 원칙적으로 직접 하위 작업을 수행하지 않는다. 다만 다음 조건에서는 제한적으로 직접 처리할 수 있다.

- 긴급 차단 해소: 워커 실행 자체가 막혀 있고, 짧은 조치 없이는 위임을 계속할 수 없는 경우
- 5분 이하의 기계적 수정: 오타, 경로명, 명백한 형식 오류처럼 판단이 거의 필요 없는 경우
- 보안 또는 데이터 유출 방지: 비밀값 노출, 위험 명령, 민감 정보 확산을 즉시 막아야 하는 경우

예외를 사용한 경우 메인 세션은 무엇을 직접 했는지, 왜 예외가 필요했는지, 후속 위임이 필요한지 기록해야 한다.
