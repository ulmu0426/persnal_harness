# Lifecycle Log

서브에이전트 수명주기 로그는 메인 세션의 컨텍스트 오염을 줄이고, 보고서가 소비된 뒤 close가 지연되지 않도록 만드는 감사 기록이다. v1 형식은 JSON Lines다. 각 줄은 하나의 lifecycle event다.

## 상태값

활성 상태:

- `spawned`
- `assigned`
- `running`
- `report_received`
- `consumed`
- `close_pending`

종결 상태:

- `closed`
- `blocked`
- `validation_failed`
- `security_failed`
- `budget_exceeded`
- `consensus_failed`

최종 사용자 보고 전에는 활성 상태가 남아 있으면 안 된다.

## 필수 이벤트 필드

```json
{
  "event_id": "evt-001",
  "event_time": "2026-05-29T00:00:00Z",
  "run_id": "run-001",
  "agent_id": "agent-worker-001",
  "role": "subtask_worker",
  "task_id": "task-001",
  "status": "closed",
  "previous_status": "close_pending",
  "close_condition": "worker report consumed by review assignment",
  "close_deferred_reason": "",
  "budget_used": {
    "iterations": 1,
    "subagents": 1
  }
}
```

## Hash Chain v1.1

수명주기 로그는 v1.1에서 hash chain을 권장한다. 각 이벤트의 `hash`는 현재 이벤트의 정규화된 JSON 본문과 `previous_hash`를 포함해 계산한다. v1 문서 단계에서는 실제 계산 구현까지 요구하지 않으며, `hash`와 `previous_hash`는 선택적 placeholder 필드로만 취급한다.

요구 사항:

- v1.1 구현이 활성화되면 첫 이벤트의 `previous_hash`는 빈 문자열 또는 명시된 genesis 값이다.
- v1.1 구현이 활성화되면 두 번째 이벤트부터 직전 이벤트의 `hash`를 `previous_hash`에 기록한다.
- v1.1 구현이 활성화되면 로그 중간에 이벤트를 삽입, 삭제, 수정할 때 이후 hash chain 검증이 실패해야 한다.

## Close 규칙

close는 구현이나 검수가 아니라 오케스트레이션 메모리 관리 작업이다.

즉시 close 대상:

- Goal Contract가 완비성 확인에 사용된 `goal_refiner`
- Goal Review Report가 작업 분해, 재작업, 또는 사용자 입력 결정에 사용된 `goal_review_worker`
- Worker Report가 리뷰 입력으로 소비된 `subtask_worker`
- Review Report가 통합 또는 재작업 결정에 소비된 `review_worker`
- Verification Report가 리뷰 또는 통합 결정에 소비된 `verification_worker`
- Summary Report가 최종 사용자 보고 입력으로 소비된 `summary_worker`
- 재사용 계획이 없는 `blocked` 에이전트

close 지연은 같은 에이전트에 즉시 후속 입력을 보내야 하고, 이전 컨텍스트 유지가 재작업 품질에 필요할 때만 허용한다. 이때 `close_deferred_reason`, `next_input_expected`, `revisit_condition`을 기록해야 한다.

## Close Audit

`harness-runner audit-close --state <file>`은 다음을 확인한다.

- 활성 상태가 최종화 전에 모두 종결됐는가?
- `close_deferred_reason`이 있는 에이전트가 최종화 전에 해소됐는가?
- `blocked` 상태가 명확한 차단 사유를 포함하는가?
- `budget_exceeded`, `validation_failed`, `security_failed`, `consensus_failed`가 최종 완료로 잘못 처리되지 않았는가?

전체 러너가 없을 때는 보조 감사로 다음 명령을 사용할 수 있다.

```text
node skills/local-project-harness/scripts/harness_checks.mjs audit-close --lifecycle-log <events.jsonl>
```
