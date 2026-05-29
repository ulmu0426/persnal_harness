# Consensus Protocol

하네스 자체를 보강하거나 보안, 기술, 관리 관점이 충돌할 수 있는 변경은 3역할 합의 프로토콜을 사용한다.

## 역할

- `security_agent`: 보안 게이트, 비밀값, 범위 이탈, 네트워크/비용, 경로 위험을 검토한다.
- `technical_agent`: 구현 가능성, 스키마 일관성, CLI 계약, 검증 가능성을 검토한다.
- `management_agent`: 운영 복잡도, 예산, 반복 정책, 완료 기준, 사용자 보고 가능성을 검토한다.

## 대화 순서

각 라운드는 아래 순서로 진행한다.

1. `security_agent`가 위험과 필수 조건을 제시한다.
2. `technical_agent`가 구현 방안과 검증 조건을 제시한다.
3. `management_agent`가 운영 기준과 범위 조정을 제시한다.
4. 세 역할이 이전 발언을 반영해 합의 가능 여부를 보고한다.

메인 세션은 발언을 요약하고 다음 라운드 입력을 구성하지만, 세 관점의 내용 판단을 직접 대체하지 않는다.

## 합의 조건

합의는 세 역할이 모두 다음을 만족한다고 보고할 때 성립한다.

- 보안 hard gate가 남아 있지 않다.
- v1 범위와 비범위가 명확하다.
- 구현자가 수행할 파일 범위와 산출물이 명확하다.
- 리뷰와 재작업 기준이 명확하다.
- 예산 안에서 반복 가능하다.

합의가 성립하면 메인 세션은 구현 워커를 새로 생성해 합의 결과를 실행하게 한다.

## 반복 예산

이 하네스는 대규모 엔터프라이즈 운영보다 개인 또는 소규모 팀의 충분한 자동화를 목표로 한다. 따라서 기본 반복 예산은 넉넉하게 둔다.

```yaml
max_iterations: 8
max_rework_iterations: 6
default_consensus_rounds: 2
max_consensus_rounds: 3
max_subagents_per_task: 16
max_open_subagents: 6
max_validation_failures: 3
max_wall_clock_minutes: 180
max_command_count:
  dry_run_v1: 0
  future_guarded_execution: 100
min_completion_score: 85
```

예산을 초과하면 `budget_exceeded`로 중단한다. 예산 증액이 필요하면 같은 실행 안에서 조용히 늘리지 않고 새 run 또는 새 phase로 기록한다.

## High-Risk Triggers

다음 변경은 3역할 합의가 필요하다.

- destructive change: 파일 삭제, 되돌리기, 마이그레이션, 데이터 파괴 가능 작업
- 네트워크 호출 또는 외부 비용 발생 작업
- 배포, 릴리스, 운영 환경 변경
- broad filesystem scope: 워크스페이스 전역 또는 다수 모듈을 한 번에 바꾸는 작업
- runner, security, schema, lifecycle, budget 정책 변경
- 비밀값, 인증, 권한, 개인정보 처리에 영향을 주는 작업

## 합의 실패

다음 경우 `consensus_failed`로 기록한다.

- `max_consensus_rounds` 안에 세 역할 합의가 성립하지 않음
- 보안 veto가 해소되지 않음
- v1 범위가 실행 코드 구현까지 확대되어 합의 범위를 벗어남
- 관리 관점에서 반복 예산 또는 완료 조건이 불명확하다고 판단함

## 구현 후 검수

구현 워커가 결과를 보고하면 기존 세 역할은 각자 같은 산출물을 읽고 평가한다.

- 세 역할이 모두 충분하다고 판단하면 완료 후보가 된다.
- 하나라도 hard gate를 제기하면 재작업한다.
- 하나라도 85점 미만의 완성도를 보고하면 `rework_items`를 구현 워커에게 재위임한다.
- 반복은 `max_rework_iterations` 안에서 진행한다.

메인 세션은 평가 내용을 직접 수정하지 않고, 세 역할의 보고서 구조와 결론 필드가 완비됐는지만 확인한다.
