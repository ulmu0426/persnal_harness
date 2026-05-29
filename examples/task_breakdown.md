# Task Breakdown Example

## 사용자 요청

"로그인 실패 시 에러 메시지를 개선하고 관련 테스트를 추가해 주세요."

## Goal Refiner 위임 예시

메인 세션은 목표 내용을 직접 분석하지 않고 요청 원문을 `goal_refiner`에게 넘긴다.

```markdown
## Goal Refinement Assignment

- task_id: auth-goal-refine-001
- role: goal_refiner
- raw_user_request: "로그인 실패 시 에러 메시지를 개선하고 관련 테스트를 추가해 주세요."
- required_output: Goal Contract
- required_fields:
  - raw_user_request
  - concrete_goal
  - success_criteria
  - scope_in
  - scope_out
  - assumptions
  - implementation_constraints
  - quality_score_threshold
  - scenario_flows
  - completion_rubric
  - verification_matrix
  - acceptance_evidence_plan
  - iteration_policy
  - open_questions
  - delegation_plan_seed
- verification_matrix_required_items:
  - build
  - lint
  - test
  - run
  - behavior_check
- question_policy:
  - 추상 요청은 사용자에게 되묻지 말고 합리적 가정으로 구체화한다.
  - 안전한 기본값이 없는 보안, 데이터 손실, 외부 비용, 되돌리기 어려운 제품 결정만 open_questions에 남긴다.
```

## Goal Refiner Report 예시

```markdown
## Goal Refiner Report

- task_id: auth-goal-refine-001
- status: completed
- goal_contract:
  raw_user_request: "로그인 실패 시 에러 메시지를 개선하고 관련 테스트를 추가해 주세요."
  concrete_goal: 로그인 실패 시 화면에 "이메일 또는 비밀번호를 확인해 주세요." 문구를 표시하고, 해당 실패 메시지를 검증하는 테스트를 추가한다.
  success_criteria:
    - 잘못된 이메일 또는 비밀번호로 로그인 실패 시 지정 문구가 표시된다.
    - 로그인 성공 흐름과 인증 API 호출 방식은 변경되지 않는다.
    - 로그인 실패 메시지를 검증하는 테스트가 존재한다.
    - 관련 검증 결과가 보고된다.
  scope_in:
    - 로그인 폼의 실패 메시지 표시 로직
    - 로그인 실패 메시지 상수 또는 문구 정의
    - 로그인 실패 케이스 테스트
  scope_out:
    - 인증 API 계약 변경
    - 로그인 성공 플로우 변경
    - 계정 잠금, 비밀번호 재설정, MFA 정책 변경
    - 전역 디자인 시스템 리팩터링
  assumptions:
    - 현재 프로젝트에 로그인 폼 컴포넌트와 관련 테스트 파일이 존재한다.
    - 실패 사유를 세분화하지 않고 보안상 일반 문구를 사용한다.
    - 테스트 실행 명령은 프로젝트의 기존 npm 스크립트를 따른다.
  implementation_constraints:
    - 기존 사용자 또는 다른 워커의 변경을 삭제하거나 되돌리지 않는다.
    - 할당된 인증 UI와 테스트 범위 밖 파일을 수정하지 않는다.
    - 민감한 인증 실패 상세 원인을 사용자에게 노출하지 않는다.
  quality_score_threshold: 85
  scenario_flows:
    - id: login-failure-message-flow
      name: 로그인 실패 메시지 표시 플로우
      actor: end_user
      preconditions:
        - 로그인 화면에 접근할 수 있다.
        - 잘못된 이메일 또는 비밀번호를 입력한다.
      steps:
        - 이메일과 비밀번호를 입력한다.
        - 로그인 버튼을 누른다.
        - 인증 실패 응답을 받는다.
      expected_result:
        - "이메일 또는 비밀번호를 확인해 주세요." 문구가 화면에 표시된다.
        - 민감한 실패 상세 원인은 노출되지 않는다.
      failure_or_edge_cases:
        - 빈 입력 상태의 검증 메시지와 인증 실패 메시지가 충돌하지 않는다.
        - 기존 로그인 성공 플로우가 유지된다.
  completion_rubric:
    question_fulfillment: 25
    functional_completeness: 20
    scenario_flow_coverage: 30
    edge_case_handling: 10
    regression_safety: 5
    verification_completeness: 10
  verification_matrix:
    build: 프로젝트 표준 빌드 또는 타입 체크 명령을 실행해 실패가 없는지 확인한다.
    lint: 프로젝트 표준 lint 명령을 실행하거나 해당 범위 lint 가능 여부를 보고한다.
    test: 로그인 폼 테스트 또는 관련 테스트 명령을 실행한다.
    run: 앱 또는 관련 화면이 실행 가능한 상태인지 확인한다.
    behavior_check: 실패 로그인 시 지정 문구가 표시되고 성공 흐름이 유지되는지 확인한다.
  acceptance_evidence_plan:
    - 로그인 실패 메시지 구현 변경 파일 목록
    - 실패 메시지 테스트 실행 결과
    - build, lint, test, run, behavior_check 결과
    - review_worker의 completion_rubric 점수와 scenario_flow_scores
  iteration_policy:
    - overall_completion_score가 85 미만이면 needs_rework로 보고한다.
    - blocking_gates가 있으면 점수와 관계없이 재작업 또는 차단으로 보고한다.
    - main_orchestrator는 rework_items를 구현 워커에게 재위임한다.
  open_questions: []
  delegation_plan_seed:
    - auth-ui-message-001: 로그인 실패 메시지 구현
    - auth-test-001: 로그인 실패 테스트 추가
    - auth-review-001: 산출물 검수 보고서 작성
- risks_or_follow_up: 인증 실패 원인별 상세 메시지는 이번 범위에서 제외한다.
```

## 메인 세션 Goal Contract 완비성 확인

메인 세션은 Goal Contract의 내용 품질을 직접 평가하지 않고 다음만 확인한다.

- 필수 필드가 모두 있는가?
- `verification_matrix`에 `build`, `lint`, `test`, `run`, `behavior_check`가 모두 있는가?
- `quality_score_threshold`, `scenario_flows`, `completion_rubric`, `acceptance_evidence_plan`, `iteration_policy`가 모두 있는가?
- `open_questions`가 비어 있어 작업 위임을 진행할 수 있는가?

## 하위 작업 목록

메인 세션은 Goal Contract의 `delegation_plan_seed`를 기반으로 하위 작업을 만든다.

| task_id | owner | status | scope | notes |
| --- | --- | --- | --- | --- |
| auth-ui-message-001 | worker | pending | 로그인 실패 메시지 구현 | UI 문구와 상태 처리만 |
| auth-test-001 | worker | pending | 로그인 실패 테스트 추가 | 테스트 파일 범위만 |
| auth-review-001 | review_worker | pending | 산출물 검수 보고서 작성 | 직접 수정 금지 |

## 서브에이전트 라이프사이클 추적 예시

메인 세션은 각 서브에이전트를 생성할 때 lifecycle record를 남기고, 보고서가 다음 단계 입력으로 소비되면 close한다.

| agent_id | role | task_id | status | close_condition | close_deferred_reason |
| --- | --- | --- | --- | --- | --- |
| agent-goal-001 | goal_refiner | auth-goal-refine-001 | closed | Goal Contract가 완비성 확인에 사용됨 |  |
| agent-worker-001 | subtask_worker | auth-ui-message-001 | running | Worker Report가 리뷰 위임 입력으로 소비된 뒤 close |  |
| agent-worker-002 | subtask_worker | auth-test-001 | running | Worker Report가 리뷰 위임 입력으로 소비된 뒤 close |  |
| agent-review-001 | review_worker | auth-review-001 | assigned | Review Report가 재위임 또는 통합 결정에 소비된 뒤 close |  |

## 워커 1 위임 예시

```markdown
## Subtask Assignment

- task_id: auth-ui-message-001
- objective: 로그인 실패 시 사용자에게 표시되는 에러 메시지를 명확하게 개선한다.
- assigned_scope: 로그인 화면의 실패 메시지 표시 로직과 관련 문구
- inputs:
  - Goal Contract: auth-goal-refine-001
  - 현재 로그인 실패 처리 방식
  - 요구 문구: "이메일 또는 비밀번호를 확인해 주세요."
- allowed_files:
  - src/features/auth/LoginForm.tsx
  - src/features/auth/messages.ts
- path_normalization_policy: workspace-relative paths only, reject absolute paths, parent traversal, env expansion, and globs
- symlink_policy: resolve before access and reject targets outside workspace
- secret_handling_policy: run secret scan, mask candidates, reject raw secret output
- network_cost_policy: network_default denied, external_cost_default denied, explicit approval required
- prohibited_actions:
  - 인증 API 호출 방식 변경
  - 테스트 파일 수정
  - unrelated UI 리팩터링
  - 기존 변경 삭제 또는 되돌리기
- expected_outputs:
  - 변경된 UI 메시지
  - 변경 파일 목록
- verification:
  - 관련 타입 체크 또는 UI 테스트 실행 가능 여부 확인
- reporting_format:
  - Worker Report 형식 사용
```

## 워커 2 위임 예시

```markdown
## Subtask Assignment

- task_id: auth-test-001
- objective: 로그인 실패 메시지에 대한 테스트를 추가한다.
- assigned_scope: 로그인 실패 케이스 테스트
- inputs:
  - Goal Contract: auth-goal-refine-001
  - 기대 문구: "이메일 또는 비밀번호를 확인해 주세요."
  - 워커 1의 변경 결과
- allowed_files:
  - src/features/auth/LoginForm.test.tsx
- path_normalization_policy: workspace-relative paths only, reject absolute paths, parent traversal, env expansion, and globs
- symlink_policy: resolve before access and reject targets outside workspace
- secret_handling_policy: run secret scan, mask candidates, reject raw secret output
- network_cost_policy: network_default denied, external_cost_default denied, explicit approval required
- prohibited_actions:
  - 프로덕션 코드 수정
  - 테스트 환경 설정 변경
  - 기존 테스트 삭제
  - 기존 변경 삭제 또는 되돌리기
- expected_outputs:
  - 실패 메시지 검증 테스트
  - 실행한 테스트 명령과 결과
- verification:
  - npm test -- LoginForm
- reporting_format:
  - Worker Report 형식 사용
```

## 리뷰 워커 검수 위임 예시

```markdown
## Subtask Assignment

- task_id: auth-review-001
- objective: 로그인 실패 메시지 변경과 테스트 추가 산출물을 독립적으로 검수하고 검수 보고서를 작성한다.
- assigned_scope: auth-ui-message-001 및 auth-test-001 산출물 검수
- inputs:
  - Goal Contract: auth-goal-refine-001
  - auth-ui-message-001 Worker Report
  - auth-test-001 Worker Report
- allowed_files:
  - src/features/auth/LoginForm.tsx
  - src/features/auth/messages.ts
  - src/features/auth/LoginForm.test.tsx
- path_normalization_policy: workspace-relative paths only, reject absolute paths, parent traversal, env expansion, and globs
- symlink_policy: resolve before access and reject targets outside workspace
- secret_handling_policy: run secret scan, mask candidates, reject raw secret output
- network_cost_policy: network_default denied, external_cost_default denied, explicit approval required
- prohibited_actions:
  - 파일 수정
  - 직접 통합 결정
  - 기존 변경 삭제 또는 되돌리기
  - 범위 밖 산출물 검수
- expected_outputs:
  - Review Worker Report
  - overall_completion_score와 passed_threshold
  - 재작업 필요 여부와 rework_items
- verification:
  - 워커 보고서의 검증 결과 확인
  - 필요하면 npm test -- LoginForm 재실행 가능 여부 확인
- reporting_format:
  - Review Worker Report 형식 사용
```

## 워커 보고서 소비 후 close 예시

메인 세션은 `auth-ui-message-001`과 `auth-test-001`의 Worker Report를 `auth-review-001` 위임 입력으로 사용한 뒤 두 구현 워커를 close한다.

| agent_id | role | task_id | status | close_condition | close_deferred_reason |
| --- | --- | --- | --- | --- | --- |
| agent-worker-001 | subtask_worker | auth-ui-message-001 | closed | Worker Report가 auth-review-001 입력으로 소비됨 |  |
| agent-worker-002 | subtask_worker | auth-test-001 | closed | Worker Report가 auth-review-001 입력으로 소비됨 |  |

## 리뷰 워커 보고서 예시: 85점 미달

```markdown
## Review Worker Report

- task_id: auth-review-001
- status: needs_rework
- reviewed_outputs:
  - auth-ui-message-001
  - auth-test-001
- scope_check: assigned_scope 안에서만 변경됨
- goal_contract_check: 성공 기준 대부분 충족, 빈 입력과 인증 실패 메시지 충돌 확인 누락
- overall_completion_score: 78
- rubric_scores:
  question_fulfillment: 22/25
  functional_completeness: 16/20
  scenario_flow_coverage: 21/30
  edge_case_handling: 5/10
  regression_safety: 5/5
  verification_completeness: 9/10
- scenario_flow_scores:
  - id: login-failure-message-flow
    score: 76
    evidence: 실패 메시지 표시와 테스트는 확인됐지만 빈 입력 검증 메시지와의 충돌 케이스가 누락됨
- score_threshold: 85
- passed_threshold: false
- blocking_gates: []
- verification_check:
  build: 통과
  lint: 통과
  test: npm test -- LoginForm 통과
  run: 미실행, 워커가 실행 가능 여부만 보고
  behavior_check: 주요 실패 플로우 통과, edge case 일부 누락
- security_check: 통과
- secret_scan_result: 통과, 비밀값 후보 없음
- scope_diff_result: 통과, allowed_files 밖 변경 없음
- command_audit:
  - command: npm test -- LoginForm
    cwd: workspace
    exit_code: 0
    purpose: 로그인 폼 테스트 검증
- budget_used:
  iterations: 1
  rework_iterations: 0
  consensus_rounds: 0
  subagents_started: 3
  open_subagents: 1
- rework_items:
  - 빈 입력 검증 메시지와 인증 실패 메시지가 동시에 표시되지 않는지 테스트를 추가한다.
  - run 검증을 실제 실행 결과 또는 명확한 실행 불가 사유로 보강한다.
- next_iteration_recommendation: auth-test-001에 edge case 테스트와 run 검증 보강을 재위임한다.
- risks_or_follow_up: 없음
- recommendation: needs_rework
```

## 재작업 위임 예시

메인 세션은 점수를 직접 조정하지 않고 `rework_items`만 새 작업으로 변환한다.
`auth-review-001` 보고서가 재작업 위임에 소비되면 `agent-review-001`을 close한다. 재작업은 기본적으로 새 서브에이전트에 맡긴다.

```markdown
## Subtask Assignment

- task_id: auth-rework-001
- objective: review_worker가 지적한 edge case 테스트와 run 검증 증거를 보강한다.
- assigned_scope: 로그인 실패 테스트와 검증 보고 보강
- inputs:
  - Goal Contract: auth-goal-refine-001
  - Review Worker Report: auth-review-001
  - rework_items:
    - 빈 입력 검증 메시지와 인증 실패 메시지가 동시에 표시되지 않는지 테스트를 추가한다.
    - run 검증을 실제 실행 결과 또는 명확한 실행 불가 사유로 보강한다.
- allowed_files:
  - src/features/auth/LoginForm.test.tsx
- path_normalization_policy: workspace-relative paths only, reject absolute paths, parent traversal, env expansion, and globs
- symlink_policy: resolve before access and reject targets outside workspace
- secret_handling_policy: run secret scan, mask candidates, reject raw secret output
- network_cost_policy: network_default denied, external_cost_default denied, explicit approval required
- prohibited_actions:
  - 프로덕션 코드 수정
  - 인증 API 호출 방식 변경
  - 기존 변경 삭제 또는 되돌리기
- expected_outputs:
  - edge case 테스트
  - 보강된 검증 결과
- verification:
  - npm test -- LoginForm
- reporting_format:
  - Worker Report 형식 사용
```

| agent_id | role | task_id | status | close_condition | close_deferred_reason |
| --- | --- | --- | --- | --- | --- |
| agent-review-001 | review_worker | auth-review-001 | closed | Review Report가 auth-rework-001 재위임 결정에 소비됨 |  |
| agent-rework-001 | subtask_worker | auth-rework-001 | running | Worker Report가 다음 리뷰 입력으로 소비된 뒤 close |  |

## 리뷰 워커 보고서 예시: 85점 이상

```markdown
## Review Worker Report

- task_id: auth-review-002
- status: accepted
- reviewed_outputs:
  - auth-ui-message-001
  - auth-test-001
  - auth-rework-001
- scope_check: assigned_scope 안에서만 변경됨
- goal_contract_check: 성공 기준과 시나리오 플로우 충족
- overall_completion_score: 91
- rubric_scores:
  question_fulfillment: 24/25
  functional_completeness: 18/20
  scenario_flow_coverage: 28/30
  edge_case_handling: 8/10
  regression_safety: 5/5
  verification_completeness: 8/10
- scenario_flow_scores:
  - id: login-failure-message-flow
    score: 92
    evidence: 실패 메시지, edge case, 성공 흐름 유지 확인
- score_threshold: 85
- passed_threshold: true
- blocking_gates: []
- verification_check:
  build: 통과
  lint: 통과
  test: npm test -- LoginForm 통과
  run: 로그인 화면 실행 확인
  behavior_check: 실패 메시지와 성공 흐름 유지 확인
- security_check: 통과
- secret_scan_result: 통과, 비밀값 후보 없음
- scope_diff_result: 통과, allowed_files 밖 변경 없음
- command_audit:
  - command: npm test -- LoginForm
    cwd: workspace
    exit_code: 0
    purpose: 로그인 폼 테스트 검증
- budget_used:
  iterations: 2
  rework_iterations: 1
  consensus_rounds: 0
  subagents_started: 4
  open_subagents: 0
- rework_items: []
- next_iteration_recommendation: 없음
- risks_or_follow_up: 없음
- recommendation: accepted
```

## 메인 세션 통합 결정 예시

메인 세션은 리뷰 워커의 검수 보고서를 받은 뒤 다음만 수행한다.

- 검수 보고서가 필수 항목을 모두 포함하는지 확인한다.
- 검수 보고서가 두 워커 산출물을 모두 다루는지 확인한다.
- `overall_completion_score`, `score_threshold`, `passed_threshold`가 있는지 확인한다.
- `security_check`, `secret_scan_result`, `scope_diff_result`, `command_audit`, `budget_used`가 있는지 확인한다.
- `passed_threshold`가 false이면 `rework_items`를 기반으로 재위임한다.
- `passed_threshold`가 true이면 보고서 기반으로 통합할지 결정한다.

메인 세션은 메시지 구현이나 테스트 수정을 직접 하지 않는다.

## 최종 보고 예시

```markdown
로그인 실패 메시지 개선 작업은 두 개의 하위 작업으로 위임했고, `review_worker`의 검수 보고서를 기반으로 통합 가능하다고 판단했습니다.

- integration_target: auth-ui-message-001
- integration_target: auth-test-001
- review_report: auth-review-002 권고 기반
- overall_completion_score: 91
- score_threshold: 85
- passed_threshold: true
- verification: review_worker 보고서상 npm test -- LoginForm 통과
- integration_decision: 통합 가능
- residual_risk: 인증 API 자체 동작은 이번 범위에서 변경하지 않았습니다.
- subagent_lifecycle: 최종 보고 전 관련 서브에이전트 모두 closed
```
