# 차체 편의 기능 제어 SW (VBC: Vehicle Body Control)

가상 차량의 **전조등 · 와이퍼 · 도어 잠금 · 계기판 경고**를 C로 구현하고, 웹 UI에서 입력을 바꿔 가며 요구사항대로 동작하는지 **블랙박스 테스트로 증명**한 팀 프로젝트입니다.

- 과정: KDT 지능형 모빌리티 엔지니어 · AI Agent 활용 SW 개발/검증 프로젝트 (2026.10)
- 팀: 5명 (팀장 장태윤)
- 기준: 고객 요구사항 사양서 VBC-SRS-001 v1.0
- 개발 도구: C (gcc, make, cppcheck), Python 웹 브리지, Claude Code (AI Agent)

## 결과 요약

| 항목 | 결과 |
|---|---|
| 필수 요구사항 | **21개 모두 충족** (공통 C1\~C5, 조명 L1\~L6, 와이퍼 W1\~W5, 도어·경고 D1\~D5) |
| 블랙박스 테스트케이스 | **42개 중 42개 PASS** (요구사항마다 2개) |
| 코드 결함 | 0건 |
| 증거 | TC별 웹 UI 기록 CSV 43개 |

상세 결과: [`tests/results/1차/06_BlackBox_TestResult_VBC_1차.xlsx`](tests/results/1차/06_BlackBox_TestResult_VBC_1차.xlsx) (결과요약 · 요구사항별 결과 · 결함 분석 · 결론)

## 기능

| 구분 | 요구사항 | 내용 |
|---|---|---|
| 공통 | C1\~C5 | N초 연속 조건, 센서 고장(0.5초 미수신·범위 밖), 유효한 속도, 차량 상태 수신 중단, 시작 상태 |
| 조명 | L1\~L6 | 시동·스위치·조도에 따른 전조등 점등/소등, 조도 센서 고장, 와이퍼 10초 연동 |
| 와이퍼 | W1\~W5 | 스위치·강우량(10/40/70%)에 따른 정지·간헐·저속·고속, 정차 시 한 단계 낮춤, 강우 센서 고장 |
| 도어·경고 | D1\~D5 | 15 km/h 자동 잠금, 시동 꺼짐·기어 P 잠금 해제, 주행 중 도어 열림 경고, 경고 우선순위 |

## 아키텍처

![SW 아키텍처](docs/02_architecture/02_SW_아키텍처_설계서_VBC_v1.4.png)

```
              웹 UI (입력 툴바 · 출력 표시)
                       │  WebSocket
                 Vehicle Controller   ← 모든 값 전달은 여기를 거침 (RTE 방식)
      ┌────────┬──────────┼──────────┬──────────────┐
   Common    Wiper    Lighting    DoorLock    ClusterWarning
```

- **기능 모듈끼리 서로 호출하지 않습니다.** 필요한 값은 Vehicle Controller가 인자로 넘깁니다. 그래서 담당자별로 독립 개발했습니다.
- 50 ms마다 `VehicleController_Step(now_ms)` 실행: 공통 규칙 → 와이퍼 → 조명 → 도어 잠금 → 계기판 경고
- 시간은 인자(`now_ms`)로 받습니다. 함수 안에서 시계를 읽지 않아 같은 입력이면 항상 같은 결과가 나옵니다.
- 주기 신호(속도·기어·시동·조도·강우량)는 100 ms마다 송신하며, 0.5초 동안 들어오지 않으면 고장·수신 중단으로 처리합니다.

## 실행 방법

필요한 것: Linux 또는 WSL, gcc, Python 3.8 이상 (외부 패키지 없음)

```bash
git clone https://github.com/James-Recon40/AI.M_Project.git
cd AI.M_Project
make            # 헤더 확인 + 컴파일
make check      # cppcheck 정적 분석
python3 web/server.py
# 브라우저에서 http://127.0.0.1:8080
```

웹 UI에서 할 수 있는 것:

- 시동·기어·속도·조도·강우량·도어·스위치를 바꾸고 전조등·와이퍼·잠금·계기판 경고 변화를 확인
- 신호별 송신 중단(센서 고장 시험), 범위 밖 값 입력
- 테스트케이스 42개 보기 → **사전조건 적용**, 공통규칙 10개는 **테스트 수행**(절차 자동 입력)
- 입력·출력 기록을 **CSV로 저장** (테스트 증거)

자세한 내용: [`web/README.md`](web/README.md)

## 개발 프로세스와 산출물

요구사항 분석 → 아키텍처 설계 → 인터페이스 정의 → 상세설계 → 모듈별 구현 → `develop` 통합 → 블랙박스 테스트

| # | 산출물 | 최종 버전 | 위치 |
|---|---|---|---|
| 01 | 요구사항 분석서 | v1.3 | [`docs/01_requirements/`](docs/01_requirements/) |
| 02 | SW 아키텍처 설계서 | v1.4 | [`docs/02_architecture/`](docs/02_architecture/) |
| 03 | 인터페이스 정의서 | v1.4 | [`docs/03_interface/`](docs/03_interface/) |
| 04 | SW 상세설계서 (.xlsx, .md) | v1.1 | [`docs/04_detailed_design/`](docs/04_detailed_design/) |
| 05 | 블랙박스 테스트케이스 | v1.4 | [`tests/test_cases/`](tests/test_cases/) |
| 06 | 1차 테스트 결과서 | 1차 | [`tests/results/1차/`](tests/results/1차/) |
| 07 | 개선 기록표 | v1.0 | [`docs/05_records/`](docs/05_records/) |
| 08 | AI 오류 기록 | v1.0 | [`docs/05_records/`](docs/05_records/) |

- 문서는 고칠 때 원본을 그대로 두고 복사해서 버전을 올렸습니다. 이전 버전도 함께 남아 있습니다.
- 교차검토를 거쳐 문서 사이의 용어·신호 이름·함수 원형을 맞췄습니다.

## 테스트 방법

- **블랙박스 테스트:** 코드가 아니라 요구사항의 입력과 출력만 보고 확인했습니다.
- **기대값은 요구사항에서:** 코드를 보고 정답을 정하지 않았습니다.
- **만든 사람 ≠ 검증한 사람:** 자기가 구현한 기능은 자기가 테스트하지 않았습니다.
- **기법:** 동등분할, 경계값 분석(예: 0.49초/0.50초, 14/15 km/h, 999/1000 lux), 결정 테이블, 상태전이·시간조건
- **증명:** 요구사항 → 입력 → 예상 결과 → 실제 결과 → 증거(CSV)가 한 줄로 이어지게 기록했습니다.

## 협업 방식

```
main        최종본
└─ develop  통합 · 테스트
   └─ feature/docs · common · vehicle-controller · wiper · lighting · door-lock-cluster · ui
```

- 각자 자기 브랜치·자기 폴더만 수정하고, PR로 `develop`에 합쳤습니다 (PR #1\~#14).
- 구현·통합 PR(#1\~#13)은 작성자가 아닌 팀원이 확인한 뒤 병합했습니다. 마지막 결과 정리 PR(#14)부터는 팀장이 병합했습니다.
- 팀 규칙은 [`CLAUDE.md`](CLAUDE.md)에 적어 AI Agent도 같은 규칙으로 일하게 했습니다.

## AI(Claude Code) 활용과 검증

- 설계 문서 작성·교차검토, 상세설계 기반 구현, 코드 리뷰, 통합 점검에 Claude Code를 썼습니다.
- **AI 결과는 사람이 근거 문서와 대조해 판정했습니다.** AI가 틀린 곳(문서 누락, 문서 간 불일치를 놓침, 요구사항에 없는 동작 추가, 잘못된 파일 생성 등)은 [08 AI 오류 기록](docs/05_records/)에 "무엇이 틀렸나 → 어떻게 알아챘나 → 어떻게 고쳤나"로 남겼습니다.
- 개발·테스트 중 발견하고 고친 문제는 [07 개선 기록표](docs/05_records/)에 정리했습니다.

## 팀

| 이름 | GitHub | 담당 |
|---|---|---|
| 장태윤 (팀장) | [James-Recon40](https://github.com/James-Recon40) | 설계 문서(01\~05), Vehicle Controller · Common 구현, 통합, 테스트 결과 정리 |
| 이상현 | [charles000303-sketch](https://github.com/charles000303-sketch) | 통합·테스트, 조명 테스트 |
| 김원 | [rladnjs210-sys](https://github.com/rladnjs210-sys) | 도어 잠금 · 계기판 경고 구현, PR 리뷰, 와이퍼 테스트 |
| 최희선 | [hseonchoi](https://github.com/hseonchoi) | 와이퍼 · 조명 구현, 도어 테스트 |
| 설선환 | [seol852323-code](https://github.com/seol852323-code) | 웹 UI · 브리지 서버 구현, 공통규칙 테스트 |

## 폴더 구조

```
AI.M_Project/
├── docs/
│   ├── 01_requirements/       요구사항 분석서
│   ├── 02_architecture/       SW 아키텍처 설계서
│   ├── 03_interface/          인터페이스 정의서
│   ├── 04_detailed_design/    SW 상세설계서 (.xlsx + .md)
│   └── 05_records/            개선 기록표, AI 오류 기록
├── src/
│   ├── common/                공통 자료형(vbc_types.h), 공통 규칙 C1~C5
│   ├── vehicle_controller/    UI ↔ 기능 모듈 제어기
│   ├── wiper/                 와이퍼 W1~W5
│   ├── lighting/              조명 L1~L6
│   └── door_lock_cluster/     도어 잠금 D1~D3, 계기판 경고 D4~D5
├── web/                       웹 UI + WebSocket 브리지 서버
├── tests/
│   ├── test_cases/            블랙박스 테스트케이스
│   └── results/1차/           테스트 결과서, 증거 CSV, 테스터 제출 원본
├── Makefile
└── CLAUDE.md                  팀·AI 공통 작업 규칙
```

## 한계

- PC 시뮬레이션 결과이며 실제 차량, CAN 통신, 하드웨어 타이밍은 확인 범위 밖입니다.
- 선택 기능(R 주행, X 추가 기능)은 구현하지 않았습니다.
- 시간 관계상 1차 테스트만 수행했습니다.
