<!-- 이 파일은 04_SW_상세설계서_VBC_v1.1.xlsx 를 자동 변환한 것입니다. 원본은 엑셀이며 내용은 같습니다. -->

---

<a id="00_목차"></a>

## 04. SW 상세설계서 - 가상 차량 차체 편의 기능  (시트: 00_목차)

> 이 문서는 구현 직전 단계에서 보는 설계서입니다. 각 함수가 무엇을 입력받고, 어떤 순서로 판단하고, 무엇을 출력하는지 정리했습니다.<br>기준: 고객 요구사항 사양서 VBC-SRS-001 v1.0, 01 요구사항 분석서 v1.3, 02 SW 아키텍처 설계서 v1.3, 03 인터페이스 정의서 v1.4, 05 BlackBox TestCase v1.3, 고객 답변 Q1~Q5

### 설계 원칙

| 번호 | 항목 | 내용 |
|---|---|---|
| 1 | 함수/변수 이름 | 03 인터페이스 정의서 v1.4 '명명 규칙'을 그대로 따른다: 함수 Module_Action(), 변수 lower_snake_case, 자료형 PascalCase_t, 상수 UPPER_SNAKE_CASE. AUTOSAR는 적용하지 않는다. |
| 2 | 모듈 구조 | UI ↔ VehicleController ↔ 기능 모듈(Common, Wiper, Lighting, DoorLock, ClusterWarning). 기능 모듈끼리는 서로 호출·참조하지 않으며, 필요한 값은 VehicleController가 함수 인자로 전달한다. Common_CheckContinuous()만 Lighting이 직접 호출하는 공통 계산 함수(신호 통신 아님). |
| 3 | 실행 주기 | VehicleController_Step()을 50 ms마다 1회 호출한다. 한 주기 안에서는 모든 모듈이 같은 current_time_ms를 사용한다(03 TIME-04). |
| 4 | 입력 송신 | 주기 신호 5개(속도·기어·시동·조도·강우량)는 100 ms마다, 이벤트 신호 6개(도어 4개·조명 스위치·와이퍼 스위치)는 값이 바뀔 때와 UI 시작·재연결 시 1회 전달된다(03 개요 B7·B9). |
| 5 | Timeout | 주기 신호가 500 ms 동안 수신되지 않으면 C2(조도·강우 센서 고장, 속도는 판정만), C4(속도·기어·시동 → 차량 상태 수신 중단)로 처리한다. 판정은 50 ms 주기로 하며 50 ms 이내 지연은 고객이 허용함(Q5). |
| 6 | 우선순위 | 각 기능은 사양서의 우선순위를 위에서 아래로 확인하고, 처음 성립한 규칙에서 결과를 정한 뒤 종료한다. 어떤 규칙도 성립하지 않으면 직전 상태를 유지한다(L3·D3, Q2). |
| 7 | 시간 처리 | 시간은 now_ms 인자로 받아 계산한다. 실제 시계를 기다리지 않고 원하는 시각을 넣어 시험할 수 있다. 경과 시간은 uint32_t 뺄셈으로 계산한다(03 TIME-07). |
| 8 | UI 연동 | 웹 UI와 VehicleController 사이의 입력·출력 메시지 규격은 18_UI_연동 시트에서 정한다. 통신 방식(WebSocket 등)은 UI 구현 시 UI 담당이 정한다(03 v1.4 개요 B10). |
| 9 | 근거 문서 | 01 요구사항 분석서 v1.3, 02 SW 아키텍처 설계서 v1.3, 03 인터페이스 정의서 v1.4, 05 BlackBox TestCase v1.3, 고객 답변 Q1~Q5. 표의 [설계 결정]은 상위 문서가 상세설계로 넘긴 사항을 이 문서에서 정한 것이다. |

### 자료형·상수 및 함수별 시트

| 시트 | 함수명 | 역할 | 관련 요구사항 | 03 근거 |
|---|---|---|---|---|
| 01_공통_자료형 | - | 모든 함수가 쓰는 상수, enum, 구조체 정의 | 전체 | 03 데이터 타입·명명 규칙 |
| 02_VC_Init | VehicleController_Init() | 프로그램 시작 시 입력·출력·공통 시간과 모든 기능 모듈을 초기 상태로 만든다. | C5 | FUN-VC-01 |
| 03_VC_SetInputs | VehicleController_SetInputs() | UI가 보낸 입력 중 signal_mask에 표시된 신호만 저장하고, 주기 신호는 '수신됨'으로 표시한다. | C2, C3, C4 (수신 기록) | FUN-VC-02 |
| 04_VC_Step | VehicleController_Step() | 50 ms마다 각 기능 모듈을 정해진 순서로 호출하고, 모듈 사이 값을 인자로 전달해 전체 출력을 한 번 계산한다. | 전체 (C1~C5, L1~L6, W1~W5, D1~D5) | FUN-VC-03 |
| 05_VC_GetOutputs | VehicleController_GetOutputs() | 최근 완료된 출력 스냅샷을 UI에 넘겨준다. | C2~C5, L1~L6, W1~W5, D1~D5 (표시) | FUN-VC-04 |
| 06_Common_Init | Common_Init() | 수신 관리와 공통 판정 상태를 초기화한다. | C2, C4, C5 | FUN-COM-01 |
| 07_Common_Update | Common_Update() | 수신 기록을 갱신하고 센서 고장(C2), 유효한 속도(C3), 차량 상태 수신 중단(C4)을 판단한다. | C2, C3, C4 | FUN-COM-02 |
| 08_Common_CheckCont | Common_CheckContinuous() | 조건이 끊기지 않고 required_ms 동안 성립했는지 판정한다(C1 'N초 연속'). | C1 (L2, L3, L6) | FUN-COM-03 |
| 09_Wiper_Init | Wiper_Init() | 와이퍼 출력을 초기 상태로 만든다. | C5 | FUN-WIP-01 |
| 10_Wiper_Update | Wiper_Update() | 시동, 와이퍼 스위치, 강우량, 강우 센서 상태, 유효한 속도로 와이퍼 동작 상태를 정한다. | W1, W4, W5, W2, W3 (우선순위 W1 > W4 > W5 > W2·W3) | FUN-WIP-02 |
| 11_Lighting_Init | Lighting_Init() | 전조등 상태와 연속시간 타이머를 초기화한다. | C1, C5 | FUN-LGT-01 |
| 12_Lighting_Update | Lighting_Update() | 시동, 조명 스위치, 조도, 조도 센서 상태, 와이퍼 동작 상태로 전조등 켜짐/꺼짐을 정한다. | C1, L1, L5, L4, L6, L2, L3 (우선순위 L1 > L5 > L4 > L6 > L2·L3) | FUN-LGT-02 |
| 13_DoorLock_Init | DoorLock_Init() | 도어 잠금 상태를 초기화한다. | C5 | FUN-DLK-01 |
| 14_DoorLock_Update | DoorLock_Update() | 차량 상태 수신 여부, 시동, 기어, 유효한 속도로 도어 잠금/해제를 정한다. | D1, D2, D3 (위에서부터 차례로 판단) | FUN-DLK-02 |
| 15_Cluster_Init | ClusterWarning_Init() | 계기판 경고를 초기화한다. | C5 | FUN-CLU-01 |
| 16_Cluster_Update | ClusterWarning_Update() | 주행 중 도어 열림과 센서 고장 중 우선순위가 가장 높은 경고 1개를 고른다. | D4, D5 (우선순위: 주행 중 도어 열림 > 조도 센서 고장 > 강우 센서 고장) | FUN-CLU-02 |
| 17_추적표 | - | 요구사항 → 함수 → 처리 순서 → 테스트케이스 연결 | C1~C5, L1~L6, W1~W5, D1~D5 | - |
| 18_UI_연동 | - | 웹 UI ↔ VehicleController 입력·출력 메시지 규격과 송신 규칙 | C2~C5 시험, 전체 표시 | 03 개요 B7~B10 |

---

<a id="01_공통_자료형"></a>

## SW 상세설계 - 공통 자료형 · 상수  (시트: 01_공통_자료형)

> 모든 모듈이 공유하는 헤더(예: vbc_types.h)에 정의한다. enum 이름·값은 03 인터페이스 정의서 v1.4 '데이터 타입'과 같고, 구조체와 비트 정의는 03이 상세설계로 넘긴 함수 인자 형식을 정하기 위해 이 문서에서 정했다([설계 결정]).

| 구분 | 이름 | 자료형 | 값 / 멤버 | 근거 |
|---|---|---|---|---|
| 매크로 상수 | MAIN_CYCLE_MS | uint32_t | 50 | 03 개요 B7 |
| 매크로 상수 | RX_TIMEOUT_MS | uint32_t | 500 | SRS C2~C4, 03 F4 |
| 매크로 상수 | L2_DARK_TIME_MS / L3_BRIGHT_TIME_MS / L6_WIPER_TIME_MS | uint32_t | 1000 / 3000 / 10000 | SRS L2·L3·L6, 03 TIME-06 |
| 매크로 상수 | LUX_DARK_THRESHOLD / LUX_BRIGHT_THRESHOLD | float | 1000.0f / 1500.0f | SRS L2·L3 |
| 매크로 상수 | LUX_MIN / LUX_MAX | float | 0.0f / 60000.0f | SRS 3.1 |
| 매크로 상수 | RAIN_MIN / RAIN_MAX | float | 0.0f / 100.0f | SRS 3.1 |
| 매크로 상수 | RAIN_INT_THRESHOLD / RAIN_LOW_THRESHOLD / RAIN_HIGH_THRESHOLD | float | 10.0f / 40.0f / 70.0f | SRS W2 |
| 매크로 상수 | SPEED_MIN / SPEED_MAX | float | 0.0f / 250.0f | SRS 3.1, C3 |
| 매크로 상수 | DOOR_LOCK_SPEED_KPH | float | 15.0f | SRS D3 |
| 입력 신호 비트 | INPUT_SIG_SPEED ~ INPUT_SIG_WIPER_SW | uint16_t 비트 | SPEED(1u<<0), GEAR(1u<<1), IGNITION(1u<<2), LIGHT(1u<<3), RAIN(1u<<4), DOOR_FL(1u<<5), DOOR_FR(1u<<6), DOOR_RL(1u<<7), DOOR_RR(1u<<8), LIGHT_SW(1u<<9), WIPER_SW(1u<<10) | 03 SIG-001~011 순서 [설계 결정] |
| 입력 신호 비트 | INPUT_SIG_PERIODIC_MASK | uint16_t | 0x001F (주기 신호 5개: 속도·기어·시동·조도·강우량) | 03 개요 B7 |
| enum | GearPosition_t | enum | GEAR_P, GEAR_R, GEAR_N, GEAR_D | 03 데이터 타입 |
| enum | LightSwitch_t | enum | LIGHT_SW_AUTO, LIGHT_SW_OFF, LIGHT_SW_ON | 03 데이터 타입 |
| enum | WiperSwitch_t | enum | WIPER_SW_OFF, WIPER_SW_AUTO, WIPER_SW_LOW, WIPER_SW_HIGH | 03 데이터 타입 |
| enum | WiperLevel_t | enum | WIPER_LEVEL_STOP, WIPER_LEVEL_INT(간헐), WIPER_LEVEL_LOW, WIPER_LEVEL_HIGH — 이 순서로 정의해 한 단계 낮추기(W3)에 사용 | 03 데이터 타입, SRS W3 |
| enum | ClusterWarning_t | enum | CLUSTER_WARNING_NONE, CLUSTER_WARNING_DOOR_OPEN, CLUSTER_WARNING_AMBIENT_SENSOR, CLUSTER_WARNING_RAIN_SENSOR | 03 데이터 타입 |
| struct | VehicleInputs_t | struct | vehicle_speed_kph(float), gear_position(GearPosition_t), ignition_on(bool), ambient_light_lux(float), rain_level_pct(float), door_fl_open·door_fr_open·door_rl_open·door_rr_open(bool), light_switch(LightSwitch_t), wiper_switch(WiperSwitch_t) | 03 SIG-001~011 [설계 결정] |
| struct | CommonStatus_t | struct | vehicle_speed_valid(bool), vehicle_state_timeout(bool), ambient_light_sensor_fault(bool), rain_sensor_fault(bool) | 03 SIG-012~015 [설계 결정] |
| struct | VehicleOutputs_t | struct | CommonStatus_t의 4개 + headlamp_on(bool), wiper_level(WiperLevel_t), door_locked(bool), cluster_warning(ClusterWarning_t) | 03 SIG-012~019, FUN-VC-04 [설계 결정] |
| struct | ContinuousTimer_t | struct | active(bool: 조건 측정 중 여부), start_ms(uint32_t: 조건이 성립하기 시작한 시각) | 03 FUN-COM-03, TIMER-01~03 [설계 결정] |

---

<a id="02_VC_Init"></a>

## SW 상세설계 - VehicleController_Init()  (시트: 02_VC_Init)

| 항목 | 내용 |
|---|---|
| 함수명 | VehicleController_Init() |
| 함수 원형 | void VehicleController_Init(void); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-VC-01 |
| 목적 | 프로그램 시작 시 입력·출력·공통 시간과 모든 기능 모듈을 초기 상태로 만든다. |
| 호출 시점 / 주기 | main()에서 프로그램 시작 시 1회, 다른 함수보다 먼저 호출 |
| 입력 | 없음 |
| 출력 | 입력 저장값, 출력 스냅샷(VehicleOutputs_t), current_time_ms |
| 관련 요구사항 | C5 |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | 프로그램 시작 | current_time_ms = 0, pending_rx_mask = 0 | C5 |
| 2 | 입력 초기값 | inputs ← 03 Initial Value: 속도 0.0, 기어 GEAR_P, 시동 false, 조도 0.0, 강우량 0.0, 도어 4개 false(닫힘), 조명·와이퍼 스위치 OFF | C5 |
| 3 | 모듈 초기화 | Common_Init(0) → Wiper_Init() → Lighting_Init() → DoorLock_Init() → ClusterWarning_Init() 순서로 호출 | C5 |
| 4 | 출력 스냅샷 초기화 | outputs: headlamp_on=false, wiper_level=STOP, door_locked=false, cluster_warning=NONE, 센서 고장 표시 2개=false(정상), vehicle_speed_valid=false, vehicle_state_timeout=false | C5, Q1 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| inputs | VehicleInputs_t | 위 초기값 | - | UI에서 받은 최신 입력값 보관(모듈 내부 static) |
| pending_rx_mask | uint16_t | 0 | 비트 | 직전 Step 이후 수신된 주기 신호 표시. Common에 전달 후 0으로 지움 |
| outputs | VehicleOutputs_t | C5 초기값 | - | 최근 완료된 출력 스냅샷. GetOutputs()가 반환 |
| current_time_ms | uint32_t | 0 | ms | 현재 주기의 시각(SIG-020) |

> 조도·강우 센서 고장 표시는 '정상'으로 시작한다(고객 답변 Q1). 조도·강우량의 최초 수신 전 값 0.0은 03 v1.4 SIG-004·005 Initial Value를 따른다.

---

<a id="03_VC_SetInputs"></a>

## SW 상세설계 - VehicleController_SetInputs()  (시트: 03_VC_SetInputs)

| 항목 | 내용 |
|---|---|
| 함수명 | VehicleController_SetInputs() |
| 함수 원형 | void VehicleController_SetInputs(const VehicleInputs_t *in, uint16_t signal_mask); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-VC-02 |
| 목적 | UI가 보낸 입력 중 signal_mask에 표시된 신호만 저장하고, 주기 신호는 '수신됨'으로 표시한다. |
| 호출 시점 / 주기 | UI 입력 메시지(18_UI_연동 시트)를 받을 때마다. 주기 신호 100 ms마다, 이벤트 신호 값 변경 시와 UI 시작·재연결 시 1회 |
| 입력 | in: VehicleInputs_t(보낸 값), signal_mask: 이번에 보낸 신호 비트(INPUT_SIG_*) |
| 출력 | inputs(저장값) 갱신, pending_rx_mask 갱신 |
| 관련 요구사항 | C2, C3, C4 (수신 기록) |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | in == NULL? | YES → 아무것도 하지 않고 종료 | - |
| 2 | signal_mask의 각 비트 확인 | 비트가 1인 신호만 inputs의 해당 필드에 복사한다. 범위 밖 값(예: 속도 300, 조도 -1)도 그대로 저장한다 — 범위 판정은 Common_Update()가 한다 | C2, C3 |
| 3 | enum 신호(기어·조명 스위치·와이퍼 스위치)의 값이 정의된 값이 아님? | YES → 그 신호는 저장하지 않고 수신으로도 기록하지 않는다(방어 처리) | [설계 결정] |
| 4 | 저장한 신호가 주기 신호(속도·기어·시동·조도·강우량)? | YES → pending_rx_mask에 해당 비트를 1로 표시(수신 시각은 다음 Step에서 current_time_ms로 기록) | C2~C4 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| valid_mask | uint16_t | - | 비트 | enum 검사를 통과해 실제로 저장한 신호 비트(지역 변수) |

> 수신 시각 기록 방식: 03 v1.4 FUN-VC-02·내부 수신관리와 같이, 수신 시에는 수신 표시만 세우고 다음 Step 시작 시 current_time_ms로 기록한다(TIME-04). 실제 수신보다 최대 50 ms 늦게 기록될 수 있으나 판정이 일찍 나지는 않으며, 50 ms 이내 지연은 고객이 허용했다(Q5).

> 이벤트 신호(도어·스위치)는 Timeout 감시 대상이 아니므로 수신 기록을 하지 않는다(03 SIG-006~011).

---

<a id="04_VC_Step"></a>

## SW 상세설계 - VehicleController_Step()  (시트: 04_VC_Step)

| 항목 | 내용 |
|---|---|
| 함수명 | VehicleController_Step() |
| 함수 원형 | void VehicleController_Step(uint32_t now_ms); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-VC-03 |
| 목적 | 50 ms마다 각 기능 모듈을 정해진 순서로 호출하고, 모듈 사이 값을 인자로 전달해 전체 출력을 한 번 계산한다. |
| 호출 시점 / 주기 | 50 ms 스케줄러(main 루프)가 50 ms마다 1회. 스케줄러가 단조 증가 시계에서 읽은 경과 시간을 now_ms로 전달 |
| 입력 | now_ms(프로그램 시작 후 경과 ms), 저장된 inputs, pending_rx_mask |
| 출력 | outputs 스냅샷(VehicleOutputs_t) |
| 관련 요구사항 | 전체 (C1~C5, L1~L6, W1~W5, D1~D5) |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | 주기 시작 | current_time_ms = now_ms (이 주기 안에서는 이 값만 사용) | TIME-04 |
| 2 | ① 공통 규칙 | Common_Update(&inputs, pending_rx_mask, current_time_ms, &status) 호출 후 pending_rx_mask = 0 | C2, C3, C4 |
| 3 | ② 와이퍼 | wiper_level = Wiper_Update(inputs.ignition_on, inputs.wiper_switch, inputs.rain_level_pct, inputs.vehicle_speed_kph, &status) | W1~W5 |
| 4 | ③ 조명 | headlamp_on = Lighting_Update(inputs.ignition_on, inputs.light_switch, inputs.ambient_light_lux, wiper_level(②의 이번 주기 결과), &status, current_time_ms) | C1, L1~L6 |
| 5 | ④ 도어 잠금 | door_locked = DoorLock_Update(inputs.ignition_on, inputs.gear_position, inputs.vehicle_speed_kph, &status) | D1~D3 |
| 6 | ⑤ 계기판 경고 | cluster_warning = ClusterWarning_Update(inputs.vehicle_speed_kph, 도어 4개 열림 상태, &status) | D4, D5 |
| 7 | 출력 모음 | outputs ← status 4개 + headlamp_on, wiper_level, door_locked, cluster_warning (한 번에 갱신) | SIG-012~019 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| status | CommonStatus_t | 모두 false | - | 이번 주기 Common 판정 결과. 다른 모듈에 인자로 전달 |
| wiper_level / headlamp_on / door_locked / cluster_warning | 각 출력 자료형 | C5 값 | - | 이번 주기 각 모듈 결과(지역 변수). 마지막에 outputs로 한 번에 복사 |

> 호출 순서 이유: Common을 먼저 호출해야 센서 고장·유효한 속도·수신 중단을 다른 모듈이 쓸 수 있다. Wiper를 Lighting보다 먼저 호출하는 이유는 L6가 이번 주기의 와이퍼 동작 상태를 쓰기 때문이다(03 SIG-017). DoorLock·ClusterWarning은 Common 결과를 쓰므로 그 뒤에 호출한다.

> now_ms 인자: 03 v1.4 TIME-02·FUN-VC-03에 따라 스케줄러가 단조 증가 시계를 읽어 전달하고, VC는 받은 값을 주기 시각으로 확정해 각 모듈에 나눠 준다. 시험에서는 임의 시각을 넣어 같은 결과를 반복 확인할 수 있다.

> 전체 처리는 다음 50 ms 주기 시작 전에 끝나야 한다(03 개요 B7).

---

<a id="05_VC_GetOutputs"></a>

## SW 상세설계 - VehicleController_GetOutputs()  (시트: 05_VC_GetOutputs)

| 항목 | 내용 |
|---|---|
| 함수명 | VehicleController_GetOutputs() |
| 함수 원형 | void VehicleController_GetOutputs(VehicleOutputs_t *out); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-VC-04 |
| 목적 | 최근 완료된 출력 스냅샷을 UI에 넘겨준다. |
| 호출 시점 / 주기 | 출력 메시지를 만들 때(18_UI_연동 시트). Step 완료 후 50 ms마다 |
| 입력 | out: 결과를 받을 VehicleOutputs_t 포인터 |
| 출력 | *out ← outputs (SIG-012~019) |
| 관련 요구사항 | C2~C5, L1~L6, W1~W5, D1~D5 (표시) |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | out == NULL? | YES → 종료 | - |
| 2 | - | *out = outputs (스냅샷 전체 복사. 계산 중인 값이 아니라 마지막으로 완료된 값) | SIG-012~019 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| 없음 | - | - | - | outputs는 02_VC_Init 시트에 정의 |

> UI의 '유효한 속도' 확인용 표시는 vehicle_speed_valid가 true면 '유효 (UI가 보낸 속도 값 km/h)', false면 '무효'로 표시한다(03 SIG-012 비고).

---

<a id="06_Common_Init"></a>

## SW 상세설계 - Common_Init()  (시트: 06_Common_Init)

| 항목 | 내용 |
|---|---|
| 함수명 | Common_Init() |
| 함수 원형 | void Common_Init(uint32_t now_ms); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-COM-01 |
| 목적 | 수신 관리와 공통 판정 상태를 초기화한다. |
| 호출 시점 / 주기 | VehicleController_Init() 안에서 1회 (now_ms = 0) |
| 입력 | now_ms(프로그램 시작 시각) |
| 출력 | 내부 수신 상태 초기값 |
| 관련 요구사항 | C2, C4, C5 |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | - | 주기 신호 5개의 last_rx_ms = now_ms (첫 값이 들어오기 전에는 시작 시점부터 0.5초를 세기 위함) | C2, C4 |
| 2 | - | 주기 신호 5개의 received = false | C3 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| rx[5] | 구조체 배열 {uint32_t last_rx_ms; bool received;} | {now_ms, false} | ms | 주기 신호별 마지막 수신 시각과 1회 이상 수신 여부. 순서: 속도, 기어, 시동, 조도, 강우량 (03 내부 수신관리의 *_last_rx_ms에 해당) |

> 판정 결과(고장·수신 중단·유효한 속도)는 저장하지 않고 매 주기 Common_Update()에서 새로 계산한다. 따라서 시작 직후 결과는 VC 출력 초기값(모두 false, 고장 표시 정상)과 같다(Q1).

---

<a id="07_Common_Update"></a>

## SW 상세설계 - Common_Update()  (시트: 07_Common_Update)

| 항목 | 내용 |
|---|---|
| 함수명 | Common_Update() |
| 함수 원형 | void Common_Update(const VehicleInputs_t *in, uint16_t rx_mask, uint32_t now_ms, CommonStatus_t *status); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-COM-02 |
| 목적 | 수신 기록을 갱신하고 센서 고장(C2), 유효한 속도(C3), 차량 상태 수신 중단(C4)을 판단한다. |
| 호출 시점 / 주기 | VehicleController_Step()의 1번째 처리, 50 ms마다 1회 |
| 입력 | in(최신 입력값), rx_mask(이번 주기 전 수신된 주기 신호 비트), now_ms |
| 출력 | status: vehicle_speed_valid, vehicle_state_timeout, ambient_light_sensor_fault, rain_sensor_fault |
| 관련 요구사항 | C2, C3, C4 |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | 수신 기록: rx_mask에 비트가 있는 주기 신호? | 그 신호의 last_rx_ms = now_ms, received = true | C2~C4 |
| 2 | 신호별 경과 시간 계산 | age = (uint32_t)(now_ms - last_rx_ms), timeout = (age >= RX_TIMEOUT_MS(500)) | C2, C4, TIME-05·07 |
| 3 | 조도: timeout 또는 조도 < 0 또는 > 60000? | YES → ambient_light_sensor_fault = true, 아니면 false (정상 값이 다시 들어오면 자동 해제) | C2 |
| 4 | 강우량: timeout 또는 강우량 < 0 또는 > 100? | YES → rain_sensor_fault = true, 아니면 false | C2 |
| 5 | 속도: timeout 또는 속도 < 0 또는 > 250? | YES → speed_sensor_fault = true(내부 판정만, 출력 없음), 아니면 false | C2, Q3 |
| 6 | 속도·기어·시동 중 하나라도 timeout? | YES → vehicle_state_timeout = true, 아니면 false | C4 |
| 7 | 속도·기어·시동 모두 1회 이상 수신 + 셋 다 timeout 아님 + speed_sensor_fault 아님? | YES → vehicle_speed_valid = true, 아니면 false | C3 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| rx[5] | 구조체 배열 | Common_Init 값 | ms | 06_Common_Init 시트 참조 |
| age_ms | uint32_t | - | ms | 신호별 마지막 수신 후 경과 시간(지역 변수) |
| speed_sensor_fault | bool | false | - | 속도 센서 고장 판정(Q3). 출력하지 않고 vehicle_speed_valid 계산에만 사용 |

> 판정 시점: 마지막 수신이 기록된 주기로부터 500 ms가 지난 첫 50 ms 주기에서 고장·수신 중단을 판정한다. 기록이 최대 50 ms 늦을 수 있어 판정도 최대 50 ms 늦어질 수 있으나 일찍 판정되지는 않는다(Q5 허용 범위).

> 첫 값이 들어오기 전: last_rx_ms가 시작 시각(0)이므로 시작 후 500 ms가 되면 고장·수신 중단으로 판정된다(C2·C4). 그 전에는 조도·강우량 초기값 0.0이 범위 안이므로 고장 표시는 정상이다(Q1). 유효한 속도는 1회 이상 수신해야 성립하므로 시작 직후에는 false다(C3).

---

<a id="08_Common_CheckCont"></a>

## SW 상세설계 - Common_CheckContinuous()  (시트: 08_Common_CheckCont)

| 항목 | 내용 |
|---|---|
| 함수명 | Common_CheckContinuous() |
| 함수 원형 | bool Common_CheckContinuous(ContinuousTimer_t *timer, bool condition, uint32_t now_ms, uint32_t required_ms); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-COM-03 |
| 목적 | 조건이 끊기지 않고 required_ms 동안 성립했는지 판정한다(C1 'N초 연속'). |
| 호출 시점 / 주기 | Lighting_Update() 안에서 50 ms마다 L2·L3·L6 조건마다 1회씩 |
| 입력 | timer(호출한 모듈이 가진 타이머 상태), condition(이번 주기 조건 성립 여부), now_ms, required_ms |
| 출력 | true: N초 연속 성립 / false: 미성립. timer 상태 갱신 |
| 관련 요구사항 | C1 (L2, L3, L6) |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | condition == false? | YES → timer->active = false, return false (조건이 깨지면 처음부터 다시 셈) | C1 |
| 2 | timer->active == false? (조건이 막 성립) | YES → timer->active = true, timer->start_ms = now_ms | C1 |
| 3 | (uint32_t)(now_ms - timer->start_ms) >= required_ms? | YES → return true / 아니면 return false (경계값에 정확히 도달한 시점부터 성립) | C1, TIME-06·07 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| 없음(상태는 인자 timer) | - | - | - | 타이머 상태는 호출한 Lighting이 보유한다(03 시간 기준 A18). Common은 계산만 한다 |

> 상위 규칙이 전조등을 정하고 있어도 Lighting은 매 주기 이 함수를 호출하므로 시간은 계속 쌓인다(C1).

---

<a id="09_Wiper_Init"></a>

## SW 상세설계 - Wiper_Init()  (시트: 09_Wiper_Init)

| 항목 | 내용 |
|---|---|
| 함수명 | Wiper_Init() |
| 함수 원형 | void Wiper_Init(void); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-WIP-01 |
| 목적 | 와이퍼 출력을 초기 상태로 만든다. |
| 호출 시점 / 주기 | VehicleController_Init() 안에서 1회 |
| 입력 | 없음 |
| 출력 | 와이퍼 내부 상태 초기화 |
| 관련 요구사항 | C5 |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | - | 내부에 보관하는 상태가 없음. 시작 직후 와이퍼 동작 상태는 VC 출력 초기값 WIPER_LEVEL_STOP | C5 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| 없음 | - | - | - | 와이퍼는 매 주기 입력만으로 결과가 정해지므로(직전 상태 유지 규칙 없음) 저장할 상태가 없다 |

---

<a id="10_Wiper_Update"></a>

## SW 상세설계 - Wiper_Update()  (시트: 10_Wiper_Update)

| 항목 | 내용 |
|---|---|
| 함수명 | Wiper_Update() |
| 함수 원형 | WiperLevel_t Wiper_Update(bool ignition_on, WiperSwitch_t wiper_switch, float rain_level_pct, float vehicle_speed_kph, const CommonStatus_t *status); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-WIP-02 |
| 목적 | 시동, 와이퍼 스위치, 강우량, 강우 센서 상태, 유효한 속도로 와이퍼 동작 상태를 정한다. |
| 호출 시점 / 주기 | VehicleController_Step()의 2번째 처리(Common 이후, Lighting 이전), 50 ms마다 |
| 입력 | ignition_on(SIG-003), wiper_switch(SIG-011), rain_level_pct(SIG-005), vehicle_speed_kph(SIG-001), status(SIG-012·013·015) |
| 출력 | WiperLevel_t (SIG-017 wiper_level) |
| 관련 요구사항 | W1, W4, W5, W2, W3 (우선순위 W1 > W4 > W5 > W2·W3) |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | 시동 꺼짐 또는 차량 상태 수신 중단? | YES → return WIPER_LEVEL_STOP | W1, C4 |
| 2 | 와이퍼 스위치 OFF / LOW / HIGH? | OFF → STOP, LOW → LOW, HIGH → HIGH 를 return | W4 |
| 3 | (AUTO) 강우 센서 고장? | YES → return WIPER_LEVEL_INT(간헐) | W5 |
| 4 | (AUTO) 강우량 단계 계산 | 강우량 < 10 → STOP, < 40 → INT, < 70 → LOW, 그 외(≥ 70) → HIGH 를 level에 저장 | W2 |
| 5 | 유효한 속도 + 속도 == 0 km/h? | YES → level을 한 단계 낮춤(HIGH→LOW→INT→STOP, STOP은 그대로) / 유효한 속도가 아니면 낮추지 않음 | W3, C3 |
| 6 | - | return level | W2, W3 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| level | WiperLevel_t | - | - | W2로 계산한 강우량 기준 단계(지역 변수). W3 적용 후 반환 |

> 속도 0 판정은 vehicle_speed_kph <= 0.0f로 한다. 유효한 속도는 0~250 범위이므로 0과 같다(실수 == 비교 회피) [설계 결정].

> 강우 센서 고장 표시는 Common이 만들고 와이퍼는 사용만 한다(03 SIG-015).

---

<a id="11_Lighting_Init"></a>

## SW 상세설계 - Lighting_Init()  (시트: 11_Lighting_Init)

| 항목 | 내용 |
|---|---|
| 함수명 | Lighting_Init() |
| 함수 원형 | void Lighting_Init(void); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-LGT-01 |
| 목적 | 전조등 상태와 연속시간 타이머를 초기화한다. |
| 호출 시점 / 주기 | VehicleController_Init() 안에서 1회 |
| 입력 | 없음 |
| 출력 | headlamp_on = false, 타이머 3개 비활성 |
| 관련 요구사항 | C1, C5 |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | - | headlamp_on = false | C5 |
| 2 | - | dark_timer, bright_timer, wiper_timer 의 active = false, start_ms = 0 | C1 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| headlamp_on, dark_timer, bright_timer, wiper_timer | - | - | - | 12_Lighting_Update 시트 참조 |

---

<a id="12_Lighting_Update"></a>

## SW 상세설계 - Lighting_Update()  (시트: 12_Lighting_Update)

| 항목 | 내용 |
|---|---|
| 함수명 | Lighting_Update() |
| 함수 원형 | bool Lighting_Update(bool ignition_on, LightSwitch_t light_switch, float ambient_light_lux, WiperLevel_t wiper_level, const CommonStatus_t *status, uint32_t now_ms); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-LGT-02 |
| 목적 | 시동, 조명 스위치, 조도, 조도 센서 상태, 와이퍼 동작 상태로 전조등 켜짐/꺼짐을 정한다. |
| 호출 시점 / 주기 | VehicleController_Step()의 3번째 처리(Wiper 이후, DoorLock 이전), 50 ms마다 |
| 입력 | ignition_on(SIG-003), light_switch(SIG-010), ambient_light_lux(SIG-004), wiper_level(SIG-017, 이번 주기), status(SIG-013·014), now_ms(SIG-020) |
| 출력 | bool headlamp_on (SIG-016) |
| 관련 요구사항 | C1, L1, L5, L4, L6, L2, L3 (우선순위 L1 > L5 > L4 > L6 > L2·L3) |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | 준비: 실효 시동 | ign = ignition_on && !vehicle_state_timeout (수신 중단이면 시동 꺼짐으로 봄) | C4 |
| 2 | 시간 조건 먼저 계산(항상) | l2 = Common_CheckContinuous(&dark_timer, ign && AUTO && 조도 센서 정상 && 조도 < 1000, now, 1000)<br>l3 = Common_CheckContinuous(&bright_timer, ign && AUTO && 조도 센서 정상 && 조도 > 1500, now, 3000)<br>l6 = Common_CheckContinuous(&wiper_timer, ign && wiper_level != STOP, now, 10000)  ← 조명 스위치와 무관 | C1, TIMER-01~03 |
| 3 | 시동 꺼짐(ign == false)? | YES → headlamp_on = false | L1 |
| 4 | 그 외 조도 센서 고장? | YES → headlamp_on = true | L5 |
| 5 | 그 외 조명 스위치 ON / OFF? | ON → true, OFF → false | L4 |
| 6 | 그 외 (AUTO) l6? | YES → headlamp_on = true (와이퍼가 작동하는 동안 유지) | L6 |
| 7 | 그 외 (AUTO) l2? | YES → headlamp_on = true | L2 |
| 8 | 그 외 (AUTO) l3? | YES → headlamp_on = false | L3 |
| 9 | 어느 규칙도 해당 없음 | headlamp_on 직전 값 유지 (예: 조도 1000~1500 lux, 시간 미충족, L6 해제 직후) | L3, Q2 |
| 10 | - | return headlamp_on | SIG-016 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| dark_timer | ContinuousTimer_t | {false, 0} | ms | TIMER-01: L2 조도 < 1000 lux 연속 시간 |
| bright_timer | ContinuousTimer_t | {false, 0} | ms | TIMER-02: L3 조도 > 1500 lux 연속 시간 |
| wiper_timer | ContinuousTimer_t | {false, 0} | ms | TIMER-03: L6 와이퍼 작동(≠ STOP) 연속 시간. 조명 스위치와 관계없이 측정 |
| headlamp_on | bool | false | - | 현재 전조등 상태. 어느 규칙도 정하지 않을 때 직전 상태 유지에 사용 |

> Q2(고객 답변): L6로 켜진 뒤 와이퍼가 정지하면 l6이 false가 되어 L2·L3 판단으로 내려가고, 둘 다 아니면 켜진 상태를 유지한다. L3의 3초는 L6가 전조등을 정하는 동안에도 쌓이므로, 조도 1500 lux 초과가 이미 3초 이상이면 와이퍼 정지 즉시 꺼진다(01 L6).

> L5 고장 표시는 Common이 만든다(03 SIG-014). Lighting은 전조등만 정한다.

---

<a id="13_DoorLock_Init"></a>

## SW 상세설계 - DoorLock_Init()  (시트: 13_DoorLock_Init)

| 항목 | 내용 |
|---|---|
| 함수명 | DoorLock_Init() |
| 함수 원형 | void DoorLock_Init(void); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-DLK-01 |
| 목적 | 도어 잠금 상태를 초기화한다. |
| 호출 시점 / 주기 | VehicleController_Init() 안에서 1회 |
| 입력 | 없음 |
| 출력 | door_locked = false |
| 관련 요구사항 | C5 |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | - | door_locked = false (잠금 해제) | C5 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| door_locked | bool | false | - | 14_DoorLock_Update 시트 참조 |

---

<a id="14_DoorLock_Update"></a>

## SW 상세설계 - DoorLock_Update()  (시트: 14_DoorLock_Update)

| 항목 | 내용 |
|---|---|
| 함수명 | DoorLock_Update() |
| 함수 원형 | bool DoorLock_Update(bool ignition_on, GearPosition_t gear_position, float vehicle_speed_kph, const CommonStatus_t *status); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-DLK-02 |
| 목적 | 차량 상태 수신 여부, 시동, 기어, 유효한 속도로 도어 잠금/해제를 정한다. |
| 호출 시점 / 주기 | VehicleController_Step()의 4번째 처리(Lighting 이후, ClusterWarning 이전), 50 ms마다 |
| 입력 | ignition_on(SIG-003), gear_position(SIG-002), vehicle_speed_kph(SIG-001), status(SIG-012·013) |
| 출력 | bool door_locked (SIG-018) |
| 관련 요구사항 | D1, D2, D3 (위에서부터 차례로 판단) |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | 차량 상태 수신 중단? | YES → door_locked 그대로 유지 | D1, C4 |
| 2 | 그 외 시동 꺼짐 또는 기어 P? | YES → door_locked = false (잠금 해제) | D2 |
| 3 | 그 외 유효한 속도 + 속도 >= 15 km/h? | YES → door_locked = true (잠금) | D3, C3 |
| 4 | D1~D3 어느 것에도 해당 없음 | door_locked 직전 값 유지 (유효한 속도 15 km/h 미만 또는 무효) | D3 |
| 5 | - | return door_locked | SIG-018 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| door_locked | bool | false | - | 현재 도어 잠금 상태. D1과 미해당 시 직전 상태 유지에 사용 |

> D2의 '시동 꺼짐'은 실제 수신된 시동 값이다. 수신 중단은 D1에서 먼저 처리되므로 D2까지 오지 않는다.

---

<a id="15_Cluster_Init"></a>

## SW 상세설계 - ClusterWarning_Init()  (시트: 15_Cluster_Init)

| 항목 | 내용 |
|---|---|
| 함수명 | ClusterWarning_Init() |
| 함수 원형 | void ClusterWarning_Init(void); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-CLU-01 |
| 목적 | 계기판 경고를 초기화한다. |
| 호출 시점 / 주기 | VehicleController_Init() 안에서 1회 |
| 입력 | 없음 |
| 출력 | 계기판 경고 없음 |
| 관련 요구사항 | C5 |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | - | 내부에 보관하는 상태가 없음. 시작 직후 계기판 경고는 VC 출력 초기값 CLUSTER_WARNING_NONE | C5 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| 없음 | - | - | - | 경고는 매 주기 다시 선택하므로(03 FUN-CLU-02) 저장할 상태가 없다 |

---

<a id="16_Cluster_Update"></a>

## SW 상세설계 - ClusterWarning_Update()  (시트: 16_Cluster_Update)

| 항목 | 내용 |
|---|---|
| 함수명 | ClusterWarning_Update() |
| 함수 원형 | ClusterWarning_t ClusterWarning_Update(float vehicle_speed_kph, bool door_fl_open, bool door_fr_open, bool door_rl_open, bool door_rr_open, const CommonStatus_t *status); |
| 인터페이스 근거 | 03 인터페이스 정의서 v1.4 FUN-CLU-02 |
| 목적 | 주행 중 도어 열림과 센서 고장 중 우선순위가 가장 높은 경고 1개를 고른다. |
| 호출 시점 / 주기 | VehicleController_Step()의 5번째 처리, 50 ms마다 |
| 입력 | vehicle_speed_kph(SIG-001), 도어 4개(SIG-006~009), status(SIG-012·014·015) |
| 출력 | ClusterWarning_t (SIG-019 cluster_warning) |
| 관련 요구사항 | D4, D5 (우선순위: 주행 중 도어 열림 > 조도 센서 고장 > 강우 센서 고장) |

### 처리 흐름 / 의사코드

| 순서 | 조건 / 확인 | 처리 내용 | 관련 요구사항 |
|---|---|---|---|
| 1 | 준비 | any_door_open = door_fl_open \|\| door_fr_open \|\| door_rl_open \|\| door_rr_open | D4 |
| 2 | 유효한 속도 + 속도 > 0 + any_door_open? | YES → return CLUSTER_WARNING_DOOR_OPEN | D4, D5, C3 |
| 3 | 조도 센서 고장? | YES → return CLUSTER_WARNING_AMBIENT_SENSOR | D5 |
| 4 | 강우 센서 고장? | YES → return CLUSTER_WARNING_RAIN_SENSOR | D5 |
| 5 | 해당 없음 | return CLUSTER_WARNING_NONE | D5 |

### 내부 변수 및 타이머 설계

| 변수명 | 자료형 | 초기값 | 단위 | 용도 / 설명 |
|---|---|---|---|---|
| any_door_open | bool | - | - | 도어 4개 중 하나라도 열림(지역 변수) |

> 차량 상태 수신 중단이면 유효한 속도가 아니므로 '주행 중 도어 열림'은 표시하지 않는다(C3).

---

<a id="17_추적표"></a>

## 요구사항 추적표 - 요구사항 → 함수 → 테스트케이스  (시트: 17_추적표)

> 처리 위치 예: '12 3' = 12_Lighting_Update 시트 처리 흐름 3번. 테스트케이스는 05 BlackBox TestCase v1.3 기준(요구사항마다 2개).

| 요구사항 | 내용 요약 | 구현 함수 | 처리 위치(시트 순서) | 테스트케이스 |
|---|---|---|---|---|
| C1 | N초 연속 판정 | Common_CheckContinuous(), Lighting_Update() | 08 1~3 / 12 2 | TC-C1-01, TC-C1-02 |
| C2 | 센서 고장(0.5초 미수신·범위 밖) | Common_Update() | 07 1~5 | TC-C2-01, TC-C2-02 |
| C3 | 유효한 속도 | Common_Update() | 07 7 | TC-C3-01, TC-C3-02 |
| C4 | 차량 상태 수신 중단 | Common_Update(), Wiper_Update(), Lighting_Update() | 07 6 / 10 1 / 12 1 | TC-C4-01, TC-C4-02 |
| C5 | 시작 상태 | VehicleController_Init() 및 각 Init() | 02 1~4 | TC-C5-01, TC-C5-02 |
| L1 | 시동 꺼짐 → 전조등 꺼짐 | Lighting_Update() | 12 3 | TC-L1-01, TC-L1-02 |
| L5 | 조도 센서 고장 → 켜짐·고장 표시 | Lighting_Update(), Common_Update() | 12 4 / 07 3 | TC-L5-01, TC-L5-02 |
| L4 | 스위치 ON/OFF | Lighting_Update() | 12 5 | TC-L4-01, TC-L4-02 |
| L6 | 와이퍼 10초 연속 작동 → 켜짐 | Lighting_Update(), Common_CheckContinuous() | 12 2·6·9 | TC-L6-01, TC-L6-02 |
| L2 | 조도 < 1000 lux 1초 → 켜짐 | Lighting_Update(), Common_CheckContinuous() | 12 2·7 | TC-L2-01, TC-L2-02 |
| L3 | 조도 > 1500 lux 3초 → 꺼짐, 그 외 유지 | Lighting_Update(), Common_CheckContinuous() | 12 2·8·9 | TC-L3-01, TC-L3-02 |
| W1 | 시동 꺼짐 → 정지 | Wiper_Update() | 10 1 | TC-W1-01, TC-W1-02 |
| W4 | 스위치 OFF/LOW/HIGH | Wiper_Update() | 10 2 | TC-W4-01, TC-W4-02 |
| W5 | AUTO + 강우 센서 고장 → 간헐 | Wiper_Update(), Common_Update() | 10 3 / 07 4 | TC-W5-01, TC-W5-02 |
| W2 | AUTO 강우량 단계 | Wiper_Update() | 10 4 | TC-W2-01, TC-W2-02 |
| W3 | 유효한 속도 0 → 한 단계 낮춤 | Wiper_Update() | 10 5 | TC-W3-01, TC-W3-02 |
| D1 | 수신 중단 → 잠금 유지 | DoorLock_Update() | 14 1 | TC-D1-01, TC-D1-02 |
| D2 | 시동 꺼짐 또는 기어 P → 해제 | DoorLock_Update() | 14 2 | TC-D2-01, TC-D2-02 |
| D3 | 유효한 속도 ≥ 15 → 잠금, 그 외 유지 | DoorLock_Update() | 14 3·4 | TC-D3-01, TC-D3-02 |
| D4 | 주행 중 도어 열림 경고 | ClusterWarning_Update() | 16 1·2 | TC-D4-01, TC-D4-02 |
| D5 | 경고 1개 우선순위 | ClusterWarning_Update() | 16 2~5 | TC-D5-01, TC-D5-02 |

---

<a id="18_UI_연동"></a>

## SW 상세설계 - UI 연동 메시지 규격 (웹 UI ↔ VehicleController)  (시트: 18_UI_연동)

> 필드명은 03 인터페이스 정의서 v1.4의 Signal Name을 그대로 쓴다. 메시지는 JSON 객체이며, 통신 방식은 UI 구현 시 정한다(03 개요 B10). UI는 VehicleController와만 통신한다.

### 입력 메시지 (UI → VehicleController)

| 구분 | 필드명 | 자료형 / 값 | 03 근거 | 설명 |
|---|---|---|---|---|
| 메시지 형식 | type | "input" | - | UI → VehicleController 입력 메시지. JSON 객체 { "type": "input", "signals": { 필드명: 값, ... } } |
| signals | vehicle_speed_kph | 숫자(km/h) | SIG-001 | 범위 밖 값도 그대로 보낸다(고장 시험용). 판정은 Common_Update |
| signals | gear_position | "P" \| "R" \| "N" \| "D" | SIG-002 | 그 외 문자열은 무시(수신으로 보지 않음) |
| signals | ignition_on | true \| false | SIG-003 | - |
| signals | ambient_light_lux | 숫자(lux) | SIG-004 | 범위 밖 값도 그대로 보낸다 |
| signals | rain_level_pct | 숫자(%) | SIG-005 | 범위 밖 값도 그대로 보낸다 |
| signals | door_fl_open / door_fr_open / door_rl_open / door_rr_open | true(열림) \| false(닫힘) | SIG-006~009 | - |
| signals | light_switch | "AUTO" \| "OFF" \| "ON" | SIG-010 | 그 외 문자열은 무시 |
| signals | wiper_switch | "OFF" \| "AUTO" \| "LOW" \| "HIGH" | SIG-011 | 그 외 문자열은 무시 |
| 수신 처리 | signals → VehicleInputs_t + signal_mask | - | FUN-VC-02 | 메시지에 들어 있는 필드만 signal_mask 비트를 1로 하여 VehicleController_SetInputs() 호출. 모르는 필드는 무시 |

### 송신 규칙

| 항목 | 규칙 | 근거 |
|---|---|---|
| 주기 신호 송신 | 100 ms마다 1개 메시지에 vehicle_speed_kph, gear_position, ignition_on, ambient_light_lux, rain_level_pct 5개를 함께 보낸다. 값이 같아도 계속 보낸다. 송신 중단된 신호는 메시지에서 뺀다 | 03 개요 B7, SRS 3.1 |
| 이벤트 신호 송신 | 도어 4개·조명 스위치·와이퍼 스위치는 값이 바뀔 때 바뀐 신호만 보낸다 | 03 개요 B7 |
| 시작·재연결 시 | UI 시작 또는 재연결 시 이벤트 신호 6개의 현재값을 한 메시지로 1회 보낸다. UI 초기 표시는 03 초기값(도어 닫힘, 조명·와이퍼 스위치 OFF)과 같게 한다 | 03 개요 B9 |
| 시험 기능 | 주기 신호 5개를 신호별로 송신 중단·재개하는 버튼을 둔다. 주기 신호를 모두 중단한 상태로 시작하는 옵션을 둔다(TC-C4-02·C5용) | 03 개요 B8, 05 TC |
| 통신 방식 | WebSocket, HTTP 등은 UI 구현 시 UI 담당이 정한다. 위 메시지 규격은 통신 방식과 관계없이 같다 | 03 개요 B10 |

### 출력 메시지 (VehicleController → UI)

| 구분 | 필드명 | 자료형 / 값 | 03 근거 | 설명 / UI 표시 |
|---|---|---|---|---|
| 메시지 형식 | type | "output" | - | VehicleController → UI 출력 메시지. Step 완료 후 50 ms마다 VehicleController_GetOutputs() 결과로 만든다 |
| 필드 | time_ms | 정수(ms) | SIG-020 | 이 출력을 계산한 주기의 current_time_ms. 화면 표시는 선택, 테스트 결과 기록(증거)에 사용 |
| 필드 | headlamp_on | true \| false | SIG-016 | 표시: 켜짐 / 꺼짐 |
| 필드 | wiper_level | "STOP" \| "INT" \| "LOW" \| "HIGH" | SIG-017 | 표시: 정지 / 간헐 / 저속 / 고속 |
| 필드 | door_locked | true \| false | SIG-018 | 표시: 잠김 / 풀림 |
| 필드 | cluster_warning | "NONE" \| "DOOR_OPEN" \| "AMBIENT_SENSOR" \| "RAIN_SENSOR" | SIG-019 | 표시: 없음 / 주행 중 도어 열림 / 조도 센서 고장 / 강우 센서 고장 |
| 필드 | ambient_light_sensor_fault | true \| false | SIG-014 | 표시: 고장 / 정상 (조도 센서 고장 표시) |
| 필드 | rain_sensor_fault | true \| false | SIG-015 | 표시: 고장 / 정상 (강우 센서 고장 표시) |
| 필드 | vehicle_speed_valid | true \| false | SIG-012 | 확인용 표시: true면 '유효 (UI가 보낸 속도 km/h)', false면 '무효' |
| 필드 | vehicle_state_timeout | true \| false | SIG-013 | 확인용 표시: 수신 중단 / 정상 |

> 예) 입력: {"type": "input", "signals": {"vehicle_speed_kph": 20.0, "gear_position": "D", "ignition_on": true, "ambient_light_lux": 5000.0, "rain_level_pct": 0.0}}<br>예) 출력: {"type": "output", "time_ms": 12350, "headlamp_on": false, "wiper_level": "STOP", "door_locked": true, "cluster_warning": "NONE", "ambient_light_sensor_fault": false, "rain_sensor_fault": false, "vehicle_speed_valid": true, "vehicle_state_timeout": false}

---

<a id="개정 이력"></a>

## 04 SW 상세설계서 개정 이력  (시트: 개정 이력)

| 버전 | 일자 | 변경 위치 | 변경 내용 | 근거 |
|---|---|---|---|---|
| 1.0 | 2026-10-12 | 전체 | 샘플 양식 내용을 최종 산출물(01·02·03·05 v1.3) 기준으로 새로 작성. 함수 15개(03 공개 함수 FUN-VC-01~CLU-02), 공통 자료형, 요구사항 추적표 작성 | 01·02·03·05 v1.3, 고객 답변 Q1~Q5 |
| 1.1 | 2026-10-12 | 18_UI_연동 신규, 03_VC_SetInputs·04_VC_Step·05_VC_GetOutputs, 00_목차 | UI 연동 메시지 규격(입력·출력 JSON, 송신 규칙, 시험 기능) 추가. 정의 없이 쓰인 '게이트웨이' 표현 삭제. 수신 시각 기록·now_ms 전달을 03 v1.4와 일치시키고 [설계 결정] 표시 해제. 근거 문서를 03 v1.4로 갱신 | 교차검토 v1.3 #1~#3, 03 v1.4 |

