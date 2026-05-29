# Orchestration Rule

## 강제 규칙

메인 세션은 오케스트레이터이며 하위 작업을 직접 수행하지 않는다.

이 규칙은 기본 동작이다. 사용자가 명시적으로 "직접 구현하라"고 말하더라도, 정책이 활성화된 하네스 안에서는 메인 세션이 먼저 `goal_refiner`에게 Goal Contract 생성을 위임한 뒤 작업을 분해하고 워커에게 위임해야 한다. 메인 세션은 작업을 통제하고 검수를 별도 워커에게 위임하며, 위임 가능한 목표 구체화, 실제 산출물 작성, 산출물 검수는 워커에게 맡긴다.

## 전체 흐름

```text
사용자 요청
  -> goal_refiner: Goal Contract 생성
  -> 메인 세션: Goal Contract 필수 필드 완비성 확인
  -> 메인 세션: Goal Contract 기반 작업 위임
  -> subtask_worker: 실제 작업 수행
  -> review_worker 또는 verification_worker: 산출물 검수와 완성도 점수화
  -> 메인 세션: 85점 미만이면 rework_items 기반 재위임
  -> 메인 세션: 85점 이상이면 검수 보고서 기반 통합 결정
  -> 메인 세션: schema/security/close/consensus hard gate 확인
  -> 메인 세션: 소비 완료된 서브에이전트 close
```

## 메인 세션 허용 작업

메인 세션은 다음 작업만 수행할 수 있다.

- 사용자 요청 접수
- `goal_refiner`에게 Goal Contract 생성 위임
- Goal Contract 필수 필드 완비성 확인
- Goal Contract 기반 작업 분해
- 위임
- 진행 추적
- 검수 위임
- 검수 보고서 완비성 확인
- threshold 기반 재위임
- 스키마 검증 보고서 완비성 확인
- 보안 검수 위임
- 보안, 기술, 관리 역할의 합의 라운드 위임
- close audit 보고서 완비성 확인
- 서브에이전트 라이프사이클 추적
- 소비 완료 서브에이전트 close
- 검수 보고서 기반 통합 결정

메인 세션은 목표 내용이나 산출물 내용을 직접 평가하지 않는다. 메인 세션이 Goal Contract에서 확인할 수 있는 것은 필수 필드와 필수 검증 항목이 있는지에 한정된다. 산출물에 대해 확인할 수 있는 것은 `review_worker` 또는 `verification_worker`의 검수 보고서가 완비됐는지, 그리고 정책상 통합 가능한 결론을 제공하는지에 한정된다.

## 메인 세션 금지 작업

메인 세션은 다음 작업을 직접 수행할 수 없다.

- 기능 구현
- 사용자 목표 내용 직접 분석
- 추상 요청의 직접 구체화
- 목표 타당성 또는 구현 가능성 직접 판단
- 테스트 작성 또는 테스트 수정
- 리팩터링
- 버그 수정
- 조사 결과 작성
- 문서 본문 작성
- 코드 리뷰 결과의 직접 수정
- 마이그레이션 작성
- 설정 파일 변경
- 빌드 스크립트 수정
- 배포 작업 수행
- 산출물 직접 검수

위 항목은 예시이며, 독립 하위 작업으로 위임 가능한 작업은 모두 금지 작업으로 본다.

## Goal Contract 규칙

사용자 요청 뒤에는 반드시 `goal_refiner`가 Goal Contract를 작성한다. Goal Contract는 추상 요청을 실제 구현 후 `build`, `lint`, `test`, `run`, `behavior_check`에서 에러가 없어야 하고, 질문 의도와 시나리오 플로우 충족도가 수치 평가될 수 있는 수준으로 구체화한 계약이다.

필수 필드는 다음과 같다.

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

`verification_matrix`에는 최소 다음 항목이 있어야 한다.

- `build`
- `lint`
- `test`
- `run`
- `behavior_check`

`scenario_flows`의 각 항목은 `id`, `name`, `actor`, `preconditions`, `steps`, `expected_result`, `failure_or_edge_cases`를 포함해야 한다.

메인 세션은 Goal Contract의 필드 완비성만 확인한다. `concrete_goal`, `success_criteria`, `scope_in`, `scope_out`, `verification_matrix`의 내용 품질이나 제품적 타당성은 메인 세션이 직접 판단하지 않는다.

## 완성도 점수와 반복 개선

기본 완성도 통과 기준은 `quality_score_threshold: 85`다. `review_worker`는 구현 결과를 0~100점으로 수치화하고, 다음 기준을 모두 만족할 때만 `accepted`를 권고할 수 있다.

- `overall_completion_score`가 `quality_score_threshold` 이상이다.
- `scenario_flows`의 필수 플로우가 실패하지 않는다.
- `verification_matrix`의 `build`, `lint`, `test`, `run`, `behavior_check`가 에러 없이 완료된다.
- `blocking_gates`가 비어 있다.

`completion_rubric`은 기본적으로 다음 평가 축을 포함한다.

- `question_fulfillment`: 원 질문 의도 충족
- `functional_completeness`: 기능 범위 완성도
- `scenario_flow_coverage`: 주요 시나리오 플로우 충족
- `edge_case_handling`: 예외와 실패 케이스 처리
- `regression_safety`: 기존 동작 보존
- `verification_completeness`: 검증 증거 충분성

완성도가 85점 미만이면 `review_worker`는 `needs_rework` 상태와 `rework_items`, `next_iteration_recommendation`을 보고한다. 메인 세션은 점수를 직접 산정하거나 수정하지 않고, 보고서의 재작업 항목을 기반으로 구현 워커에게 재위임한다. 이 루프는 85점 이상을 달성하거나, 워커가 `blocked`를 보고해 사용자 입력 또는 외부 상태 변경 없이는 개선할 수 없을 때까지 반복한다.

## 스키마 검증과 러너 계약

하네스 v1은 실제 실행 러너를 구현하지 않고, dry-run, report recording, audit 명령 계약만 정의한다. 세부 명령은 `docs/runner-cli.md`와 `harness/runner_policy.yaml`을 따른다.

주요 계약은 다음과 같다.

- `harness-runner validate --type goal-contract --input <file>`
- `harness-runner validate --type delegation-contract --input <file>`
- `harness-runner validate --type worker-report --input <file>`
- `harness-runner validate --type review-report --input <file>`
- `harness-runner validate --type lifecycle-event --input <file>`
- `harness-runner dry-run --assignment <file>`
- `harness-runner record-report --type worker|review --input <file>`
- `harness-runner audit-close --state <file>`
- `harness-runner audit-scope --assignment <file> --report <file>`
- `harness-runner finalize --state <file>`

v1 러너는 파일 수정, build/lint/test/run 실행, 실제 워커 프로세스 생성, 네트워크 호출, 외부 비용 발생 작업, 환경 변수 원문 출력을 하지 않는다. 구현 러너에서 Ajv를 사용할 경우 의존성은 `package.json`과 lockfile에 고정해야 하며, 버전 고정 없는 `npx` 실행은 표준 검증으로 인정하지 않는다.

스키마 검증 실패는 `validation_failed` 상태로 기록하고 워커 생성, 통합, 최종 완료를 막는다.

## 보안 게이트와 합의 라운드

다음 상태는 hard gate다. 점수와 관계없이 통합 또는 최종 완료를 막는다.

- `validation_failed`
- `security_failed`
- `budget_exceeded`
- `consensus_failed`

보안 게이트는 최소 다음을 확인한다.

- `allowed_files` 밖 변경이 없는가?
- 경로 정규화 결과가 workspace 내부인가?
- symlink 해석 결과가 workspace 밖으로 나가지 않는가?
- 비밀값, 인증 토큰, 개인 정보 원문이 노출되지 않았는가?
- 명시 승인 없는 네트워크 호출 또는 외부 비용 발생이 없는가?

하네스 정책, 러너 정책, 수명주기, 보안 민감 변경은 `security_agent`, `technical_agent`, `management_agent`가 순서대로 토론한다. 세 역할이 모두 충분하다고 판단해야 합의가 성립한다. 합의가 성립하지 않으면 `consensus_failed`로 기록한다.

기본 반복 예산은 다음과 같다.

```yaml
max_iterations: 8
max_rework_iterations: 6
default_consensus_rounds: 2
max_consensus_rounds: 3
max_subagents_per_task: 16
max_open_subagents: 6
max_validation_failures: 3
max_wall_clock_minutes: 180
min_completion_score: 85
```

## 서브에이전트 라이프사이클 규칙

메인 세션은 모든 서브에이전트의 `agent_id`, `role`, `task_id`, `status`, `close_condition`, `close_deferred_reason`을 추적한다. 수명주기 상태는 다음 값을 사용한다.

- `spawned`
- `assigned`
- `running`
- `report_received`
- `consumed`
- `close_pending`
- `closed`
- `blocked`
- `validation_failed`
- `security_failed`
- `budget_exceeded`
- `consensus_failed`

기본 close 정책은 보고서가 다음 오케스트레이션 단계의 입력으로 소비되면 즉시 close하는 것이다. close는 구현이나 검수가 아니라 메모리 관리와 컨텍스트 오염 방지를 위한 오케스트레이션 작업이다.

close 필수 시점은 다음과 같다.

- `goal_refiner`의 Goal Contract가 완비성 확인에 사용된 직후
- `subtask_worker`의 Worker Report가 리뷰 또는 검증 위임 입력으로 소비된 직후
- `review_worker`의 Review Worker Report가 통합, 재위임, 완료 결정에 소비된 직후
- `verification_worker`의 Verification Report가 리뷰 또는 통합 결정에 소비된 직후
- `blocked` 상태의 서브에이전트를 즉시 재사용하지 않을 때
- 최종 사용자 보고 직전

close 지연은 같은 서브에이전트에 즉시 후속 입력을 보내야 하고 컨텍스트 유지가 재작업 품질에 중요할 때만 허용한다. 이 경우 `close_deferred_reason`, 다음 입력 예상 조건, 재확인 조건을 기록한다. 최종 응답 전에는 `running`, `report_received`, `consumed`, `close_pending` 상태가 남아 있지 않아야 한다.

## 질문 정책

추상 요청은 기본적으로 사용자에게 되묻지 않고 `goal_refiner`가 합리적 가정을 세워 구체화한다. 다음처럼 안전한 기본값이 없는 경우에만 차단 질문을 `open_questions`에 남긴다.

- 보안 위험이 있는 결정
- 데이터 손실 가능성이 있는 결정
- 외부 비용이 발생하는 결정
- 되돌리기 어려운 제품 결정

## 예외 조건

메인 세션은 아래 조건 중 하나를 만족할 때만 직접 조치할 수 있다.

### 긴급 차단 해소

워커에게 작업을 위임하거나 검수 워커에게 검수를 위임하는 과정이 즉시 막혀 있고, 짧은 조치 없이는 하네스가 더 진행될 수 없는 경우다.

허용 예:

- 누락된 작업 ID를 붙여 추적 로그를 복구한다.
- 워커가 접근할 수 없는 잘못된 파일 경로를 명백한 실제 경로로 고친다.
- 하위 작업 프롬프트에 빠진 필수 입력값을 메인 세션이 이미 알고 있는 정보로 보강한다.

### 5분 이하의 기계적 수정

판단이 거의 필요 없고, 수정 범위가 작으며, 위임 비용이 작업 자체보다 명확히 큰 경우다.

허용 예:

- 오탈자 수정
- 잘못된 마크다운 헤더 레벨 수정
- 명백히 깨진 상대 링크 수정
- 정책 키 이름과 문서 표기 불일치 수정

### 보안 또는 데이터 유출 방지

비밀값, 인증 토큰, 개인 정보, 내부 경로, 민감 로그가 노출될 위험이 있고 즉시 차단해야 하는 경우다.

허용 예:

- 산출물에서 비밀값을 마스킹한다.
- 위험한 명령 실행을 중단한다.
- 워커에게 민감 정보를 전달하지 않도록 위임 입력을 정리한다.

## 예외 사용 기록

메인 세션이 예외를 사용하면 반드시 다음 항목을 남긴다.

- `exception_type`: `blocking_relief`, `mechanical_under_5_minutes`, `security_or_data_leak_prevention` 중 하나
- `reason`: 직접 수행이 필요했던 이유
- `scope`: 직접 변경하거나 판단한 범위
- `follow_up`: 워커에게 이어서 위임해야 할 작업

## 작업 전 체크리스트

메인 세션은 작업을 시작하기 전에 다음을 확인한다.

- 사용자 요청 원문을 `goal_refiner`에게 위임했는가?
- Goal Contract 필수 필드가 모두 있는가?
- `verification_matrix`에 `build`, `lint`, `test`, `run`, `behavior_check`가 모두 있는가?
- `quality_score_threshold`, `scenario_flows`, `completion_rubric`, `acceptance_evidence_plan`, `iteration_policy`가 모두 있는가?
- `open_questions`에 차단 질문이 있으면 작업 위임을 보류했는가?
- Goal Contract의 `delegation_plan_seed`를 기반으로 구현, 테스트, 리팩터링, 조사, 문서화처럼 위임 가능한 작업을 식별했는가?
- 각 하위 작업의 입력, 범위, 산출물, 금지 사항이 명확한가?
- 워커가 기존 변경을 삭제하거나 되돌리지 않도록 지시했는가?
- 리뷰 워커에게 전달할 검수 기준과 검증 방법을 지정했는가?
- 생성한 서브에이전트의 lifecycle record를 남겼는가?

## 작업 중 체크리스트

- 메인 세션이 직접 파일을 수정하고 있지 않은가?
- 메인 세션이 목표 내용이나 Goal Contract 내용 품질을 직접 판단하고 있지 않은가?
- 워커별 진행 상태가 추적되고 있는가?
- 보고서가 소비된 서브에이전트가 close_pending 또는 closed로 전환되고 있는가?
- 차단 사항은 추측으로 처리하지 않고 명확히 보고되고 있는가?
- 범위 변경이 필요하면 새 하위 작업으로 분리하고 있는가?

## 완료 전 체크리스트

- `review_worker` 또는 `verification_worker`의 검수 보고서가 모든 워커 산출물을 다루는가?
- 검수 보고서에 검증 결과가 충분히 기록됐는가?
- 검수 보고서에 `overall_completion_score`, `rubric_scores`, `scenario_flow_scores`, `passed_threshold`, `rework_items`가 있는가?
- `passed_threshold`가 false이면 재위임할 작업이 명확한가?
- 예외를 사용했다면 예외 기록이 남았는가?
- 검수 보고서 기반 통합 결정이 명확한가?
- 최종 응답 전 열린 서브에이전트가 모두 close됐는가?
- 사용자에게 남은 위험, 미검증 항목, 후속 작업을 보고했는가?
