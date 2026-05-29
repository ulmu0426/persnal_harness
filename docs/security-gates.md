# Security Gates

보안 게이트는 워커 생성, 산출물 기록, 리뷰, 통합, 최종화를 막을 수 있는 hard gate다. 보안 역할 에이전트가 veto를 내리면 점수와 관계없이 `security_failed`로 처리한다.

## 기본 게이트

### Scope Gate

- 모든 위임 계약은 `allowed_files`를 포함해야 한다.
- 모든 보고서는 `changed_files` 또는 `reviewed_outputs`를 포함해야 한다.
- `allowed_files` 밖 변경은 hard fail이다.
- v1의 `allowed_files`는 concrete workspace-relative path 목록이어야 하며 glob 패턴은 거부한다.
- 삭제, 되돌리기, 마이그레이션, 설정 변경은 명시 범위 없이는 금지한다.

### Path Gate

- 경로는 워크스페이스 기준 상대 경로로 정규화한다.
- `..`, 절대 경로, 드라이브 루트, 홈 디렉터리 확장은 거부한다.
- `*`, `**`, `?`, `[]` 같은 glob 패턴과 환경 변수 확장은 거부한다.
- symlink는 해석 후에도 워크스페이스 내부에 있어야 한다.
- 워크스페이스 밖 경로로 해석되면 `security_failed`다.

### Secret Gate

- 비밀값, 인증 토큰, 개인 정보, 민감 로그 원문은 보고서와 로그에 남기지 않는다.
- 워커 보고서는 `secret_scan_result`를 포함한다.
- 비밀값 후보가 발견되면 원문 대신 마스킹 결과와 위치만 보고한다.

### Network And Cost Gate

- v1 러너는 네트워크 호출과 외부 비용 발생 작업을 수행하지 않는다.
- 향후 실행 러너가 추가되더라도 네트워크와 비용 발생 작업은 기본 거부다.
- 명시 승인이 없는 외부 API 호출, 패키지 설치, 결제성 작업은 hard fail이다.

### Command Gate

- v1 러너는 build, lint, test, run 명령을 직접 실행하지 않는다.
- 향후 실행 러너에서 명령 실행을 허용할 경우 `command_audit`가 필요하다.
- command audit에는 명령, 작업 디렉터리, 목적, 예상 산출물, 종료 코드, 마스킹된 출력 요약을 남긴다.

## 하드 실패 상태

- `security_failed`: 보안 veto, 비밀값 노출, workspace escape, unauthorized network/cost
- `validation_failed`: 스키마 또는 필수 보고서 구조 검증 실패
- `budget_exceeded`: 반복, 재작업, 서브에이전트, 시간 예산 초과
- `consensus_failed`: 보안, 기술, 관리 역할이 합의하지 못함

## 리뷰 요구 사항

보안 관점 리뷰는 최소 다음을 확인한다.

- `allowed_files`와 실제 변경 범위가 일치하는가?
- 경로 정규화와 symlink 정책을 위반하지 않았는가?
- 보고서와 로그에 비밀값 원문이 없는가?
- 네트워크 또는 비용 발생 작업이 명시 승인 없이 포함되지 않았는가?
- 실패 상태가 성공으로 오분류되지 않았는가?

보안 관점이 충분하지 않다고 판단하면 구현 워커에게 직접 수정하지 않고 `rework_items`를 생성한다.
