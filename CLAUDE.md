# AI.M_Project 팀 규칙

가상 차량 차체 편의 기능(조명·와이퍼·도어 잠금·계기판 경고)을 C로 구현하고, 웹 UI로 시연한다.

## 기준 문서 (이 문서들과 다르게 만들지 않는다)
- 고객 요구사항: VBC-SRS-001 v1.0 (요구사항 ID: C1~C5, L1~L6, W1~W5, D1~D5)
- `docs/01_requirements/` 요구사항 분석서
- `docs/02_architecture/` SW 아키텍처 설계서
- `docs/03_interface/` 인터페이스 정의서 (신호 이름·자료형·공개 함수의 기준)
- `docs/04_detailed_design/` SW 상세설계서 (함수 원형·처리 순서·내부 변수의 기준)
- `tests/test_cases/` 블랙박스 테스트케이스

## 구조
- UI(웹) ↔ VehicleController ↔ 기능 모듈(Common, Wiper, Lighting, DoorLock, ClusterWarning)
- 기능 모듈끼리 서로 호출·include 하지 않는다. 필요한 값은 VehicleController가 인자로 넘긴다.
  예외: Lighting은 공통 계산 함수 `Common_CheckContinuous()`를 호출한다.
- 공유 자료형·상수는 `src/common/vbc_types.h`, 함수 원형은 각 모듈 헤더(`*.h`)에 있다.

## 빌드
- `make` : 헤더 문법 확인 + 컴파일
- `make check` : cppcheck 정적 분석
- 작업을 끝내기 전에 `make`와 `make check`를 실행하고 결과를 보여 준다.

## 수정 범위
- 자기 브랜치의 담당 폴더만 수정한다.

| 브랜치 | 폴더 |
|---|---|
| feature/common | `src/common/` |
| feature/vehicle-controller | `src/vehicle_controller/` |
| feature/wiper | `src/wiper/` |
| feature/lighting | `src/lighting/` |
| feature/door-lock-cluster | `src/door_lock_cluster/` |
| feature/ui | `web/` |

- 헤더(`*.h`)의 함수 원형, `vbc_types.h`, `Makefile`, `CLAUDE.md`는 고치지 않는다. 바꿔야 하면 팀장에게 요청한다.

## 구현 규칙
- 함수 원형, 처리 순서, 내부 변수는 04 SW 상세설계서를 그대로 따른다.
- 이름은 03 명명 규칙을 따른다: 함수 `Module_Action()`, 변수 `lower_snake_case`, 자료형 `PascalCase_t`, 상수 `UPPER_SNAKE_CASE`.
- 숫자를 코드에 직접 쓰지 않고 `vbc_types.h`의 상수를 쓴다.
- 모듈 내부 변수와 보조 함수는 `static`으로 둔다.
- 시간은 인자로 받은 `now_ms`만 쓰고, 함수 안에서 시계를 직접 읽지 않는다.
- 요구사항이나 설계서에 없는 동작이 필요하면 지어내지 말고 질문한다.
- 코드 주석에 관련 요구사항 ID를 적는다. 예: `/* W3 */`

## 테스트
- 테스트의 기대값은 요구사항·테스트케이스 문서에서 가져온다. 코드를 보고 기대값을 정하지 않는다.
- 테스트를 지우거나 기대값을 바꿔서 통과시키지 않는다.

## Git
- main, develop에 직접 push하지 않는다. 자기 브랜치에 push한 뒤 PR(→ develop)을 만든다.
- PR은 다른 팀원이 확인하고 병합한다.
