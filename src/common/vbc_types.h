/*
 * vbc_types.h - 모든 모듈이 공유하는 상수, enum, 구조체
 * 근거: 04 SW 상세설계서 v1.1 '01_공통_자료형', 03 인터페이스 정의서 v1.4 '데이터 타입'
 */
#ifndef VBC_TYPES_H
#define VBC_TYPES_H

#include <stdbool.h>
#include <stdint.h>

/* ---- 시간 (03 개요 B7, TIME-06) ---- */
#define MAIN_CYCLE_MS           50u     /* VehicleController_Step() 호출 주기 */
#define RX_TIMEOUT_MS           500u    /* C2~C4 미수신 판정 */
#define L2_DARK_TIME_MS         1000u   /* L2 */
#define L3_BRIGHT_TIME_MS       3000u   /* L3 */
#define L6_WIPER_TIME_MS        10000u  /* L6 */

/* ---- 값 범위와 기준값 (SRS 3.1, L2·L3, W2, D3) ---- */
#define LUX_MIN                 0.0f
#define LUX_MAX                 60000.0f
#define LUX_DARK_THRESHOLD      1000.0f
#define LUX_BRIGHT_THRESHOLD    1500.0f
#define RAIN_MIN                0.0f
#define RAIN_MAX                100.0f
#define RAIN_INT_THRESHOLD      10.0f
#define RAIN_LOW_THRESHOLD      40.0f
#define RAIN_HIGH_THRESHOLD     70.0f
#define SPEED_MIN               0.0f
#define SPEED_MAX               250.0f
#define DOOR_LOCK_SPEED_KPH     15.0f

/* ---- 입력 신호 비트 (03 SIG-001~011 순서) ---- */
#define INPUT_SIG_SPEED         (1u << 0)
#define INPUT_SIG_GEAR          (1u << 1)
#define INPUT_SIG_IGNITION      (1u << 2)
#define INPUT_SIG_LIGHT         (1u << 3)
#define INPUT_SIG_RAIN          (1u << 4)
#define INPUT_SIG_DOOR_FL       (1u << 5)
#define INPUT_SIG_DOOR_FR       (1u << 6)
#define INPUT_SIG_DOOR_RL       (1u << 7)
#define INPUT_SIG_DOOR_RR       (1u << 8)
#define INPUT_SIG_LIGHT_SW      (1u << 9)
#define INPUT_SIG_WIPER_SW      (1u << 10)
#define INPUT_SIG_PERIODIC_MASK 0x001Fu /* 주기 신호 5개: 속도·기어·시동·조도·강우량 */

/* ---- enum (03 데이터 타입) ---- */
typedef enum {
    GEAR_P,
    GEAR_R,
    GEAR_N,
    GEAR_D
} GearPosition_t;

typedef enum {
    LIGHT_SW_AUTO,
    LIGHT_SW_OFF,
    LIGHT_SW_ON
} LightSwitch_t;

typedef enum {
    WIPER_SW_OFF,
    WIPER_SW_AUTO,
    WIPER_SW_LOW,
    WIPER_SW_HIGH
} WiperSwitch_t;

/* 순서 고정: W3(한 단계 낮추기)에서 사용 */
typedef enum {
    WIPER_LEVEL_STOP,
    WIPER_LEVEL_INT, /* 간헐 */
    WIPER_LEVEL_LOW,
    WIPER_LEVEL_HIGH
} WiperLevel_t;

typedef enum {
    CLUSTER_WARNING_NONE,
    CLUSTER_WARNING_DOOR_OPEN,
    CLUSTER_WARNING_AMBIENT_SENSOR,
    CLUSTER_WARNING_RAIN_SENSOR
} ClusterWarning_t;

/* ---- 구조체 (04 '01_공통_자료형') ---- */
typedef struct {
    float            vehicle_speed_kph;  /* SIG-001 */
    GearPosition_t   gear_position;      /* SIG-002 */
    bool             ignition_on;        /* SIG-003 */
    float            ambient_light_lux;  /* SIG-004 */
    float            rain_level_pct;     /* SIG-005 */
    bool             door_fl_open;       /* SIG-006 */
    bool             door_fr_open;       /* SIG-007 */
    bool             door_rl_open;       /* SIG-008 */
    bool             door_rr_open;       /* SIG-009 */
    LightSwitch_t    light_switch;       /* SIG-010 */
    WiperSwitch_t    wiper_switch;       /* SIG-011 */
} VehicleInputs_t;

typedef struct {
    bool vehicle_speed_valid;        /* SIG-012 */
    bool vehicle_state_timeout;      /* SIG-013 */
    bool ambient_light_sensor_fault; /* SIG-014 */
    bool rain_sensor_fault;          /* SIG-015 */
} CommonStatus_t;

typedef struct {
    bool             vehicle_speed_valid;        /* SIG-012 */
    bool             vehicle_state_timeout;      /* SIG-013 */
    bool             ambient_light_sensor_fault; /* SIG-014 */
    bool             rain_sensor_fault;          /* SIG-015 */
    bool             headlamp_on;                /* SIG-016 */
    WiperLevel_t     wiper_level;                /* SIG-017 */
    bool             door_locked;                /* SIG-018 */
    ClusterWarning_t cluster_warning;            /* SIG-019 */
} VehicleOutputs_t;

/* C1 'N초 연속' 판정용 상태 (03 FUN-COM-03, TIMER-01~03) */
typedef struct {
    bool     active;   /* 조건 측정 중 여부 */
    uint32_t start_ms; /* 조건이 성립하기 시작한 시각 */
} ContinuousTimer_t;

#endif /* VBC_TYPES_H */
