# Schema Validation

이 하네스의 v1 검증 범위는 문서, JSON Schema, 예제 데이터까지다. 실제 워커 실행, 파일 수정, 빌드, 테스트, 네트워크 호출은 러너 v1 범위가 아니다. 검증은 오케스트레이션 입력과 보고서가 정책에서 요구하는 구조를 만족하는지 확인하는 데 사용한다.

## 검증 대상

- `schemas/goal_contract.schema.json`: `goal_refiner`가 만든 Goal Contract 구조
- `schemas/delegation_contract.schema.json`: 메인 세션이 워커에게 전달하는 위임 계약
- `schemas/worker_report.schema.json`: 구현 또는 문서화 워커의 결과 보고서
- `schemas/review_report.schema.json`: `review_worker` 또는 `verification_worker`의 검수 보고서
- `schemas/summary_report.schema.json`: `summary_worker`의 최종 Summary Report
- `schemas/lifecycle_event.schema.json`: 서브에이전트 수명주기 이벤트 로그
- `schemas/runner_policy.schema.json`: dry-run 러너 정책 파일
- `schemas/run_state.schema.json`: 한 실행 단위의 집계 상태

## 검증 원칙

- 모든 구조 검증은 JSON Schema draft 2020-12 기준을 따른다.
- 구현 러너에서 Ajv를 사용할 경우 의존성은 `package.json`과 lockfile에 고정한다.
- `npx --yes ajv ...`처럼 버전이 고정되지 않은 일회성 실행은 하네스 표준 검증 방법으로 인정하지 않는다.
- 스키마 검증 실패는 `validation_failed` 상태로 기록하고, 워커 생성, 통합, 최종 완료를 막는 hard gate로 처리한다.
- 메인 세션은 검증 결과의 존재와 통과 여부만 확인한다. 스키마나 보고서 내용의 품질 평가는 전용 워커가 맡는다.

## 권장 명령 계약

실제 CLI 구현 전까지 아래 명령은 명세로만 존재한다.

```text
harness-runner validate --type goal-contract --input <file>
harness-runner validate --type delegation-contract --input <file>
harness-runner validate --type worker-report --input <file>
harness-runner validate --type review-report --input <file>
harness-runner validate --type summary-report --input <file>
harness-runner validate --type lifecycle-event --input <file>
harness-runner validate --type runner-policy --input <file>
harness-runner validate --type run-state --input <file>
```

검증 출력은 최소 다음 필드를 포함해야 한다.

```json
{
  "status": "passed",
  "schema": "goal-contract",
  "input": "examples/goal_contract.valid.json",
  "errors": [],
  "validator": {
    "name": "ajv",
    "version": "pinned-by-lockfile"
  }
}
```

## 하드 실패 조건

- 필수 필드 누락
- `quality_score_threshold`가 85 미만
- `verification_matrix`에서 `build`, `lint`, `test`, `run`, `behavior_check` 중 하나 누락
- `allowed_files`가 비어 있거나, glob/절대 경로/상위 디렉터리 이동/홈 또는 환경 변수 확장을 포함함
- 리뷰 보고서에 `overall_completion_score`, `score_threshold`, `passed_threshold`, `blocking_gates`, `rework_items` 누락
- 수명주기 이벤트에 `agent_id`, `task_id`, `status`, `event_time`, `close_condition` 누락
- 상태값이 정책에 없는 값임

## 메인 세션 처리

메인 세션은 검증 보고서에서 다음만 확인한다.

- 검증 대상 파일과 스키마 타입이 맞는가?
- `status`가 `passed`인가?
- 실패 시 `errors`가 보고됐는가?
- 실패 상태가 `validation_failed`로 기록됐는가?

검증 실패가 있으면 메인 세션은 실패 내용을 직접 수정하지 않고, 해당 스키마나 보고서 작성 책임이 있는 워커에게 재위임한다.
