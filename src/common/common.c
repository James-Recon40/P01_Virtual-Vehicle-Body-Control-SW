/*
 * common.c - 공통 규칙: 센서 고장(C2), 유효한 속도(C3), 차량 상태 수신 중단(C4), N초 연속(C1)
 * 근거: 04 SW 상세설계서 v1.1 시트 06_Common_Init, 07_Common_Update, 08_Common_CheckCont
 *       03 인터페이스 정의서 v1.4 FUN-COM-01~03, 내부 수신관리, TIME-05~07
 */
#include <stddef.h>

#include "common.h"

/* 주기 신호 5개: 속도, 기어, 시동, 조도, 강우량 (04 '06_Common_Init' rx[5] 순서) */
#define RX_SIGNAL_COUNT 5u

enum {
    RX_SPEED,
    RX_GEAR,
    RX_IGNITION,
    RX_LIGHT,
    RX_RAIN
};

static const uint16_t rx_signal_bit[RX_SIGNAL_COUNT] = {
    INPUT_SIG_SPEED, INPUT_SIG_GEAR, INPUT_SIG_IGNITION, INPUT_SIG_LIGHT, INPUT_SIG_RAIN
};

typedef struct {
    uint32_t last_rx_ms; /* 마지막 수신 시각 */
    bool     received;   /* 1회 이상 수신 여부 */
} RxRecord_t;

static RxRecord_t rx[RX_SIGNAL_COUNT];
static bool       speed_sensor_fault; /* Q3: 속도 센서 고장 판정만, 출력 없음 */

/* FUN-COM-01 (04 '06_Common_Init') */
void Common_Init(uint32_t now_ms)
{
    uint32_t i;

    for (i = 0u; i < RX_SIGNAL_COUNT; i++) {
        /* 1. 첫 값이 들어오기 전에는 시작 시점부터 0.5초를 셈 (C2, C4) */
        rx[i].last_rx_ms = now_ms;
        /* 2. C3 */
        rx[i].received = false;
    }
    speed_sensor_fault = false;
}

/* FUN-COM-02 (04 '07_Common_Update') */
void Common_Update(const VehicleInputs_t *in, uint16_t rx_mask, uint32_t now_ms, CommonStatus_t *status)
{
    bool     timeout[RX_SIGNAL_COUNT];
    uint32_t i;

    if ((in == NULL) || (status == NULL)) {
        return;
    }

    for (i = 0u; i < RX_SIGNAL_COUNT; i++) {
        /* 1. 수신 기록: 이번 주기 전에 수신된 주기 신호 (C2~C4) */
        if ((rx_mask & rx_signal_bit[i]) != 0u) {
            rx[i].last_rx_ms = now_ms;
            rx[i].received   = true;
        }
        /* 2. 경과 시간과 timeout (C2, C4, TIME-05·07) */
        timeout[i] = ((uint32_t)(now_ms - rx[i].last_rx_ms) >= RX_TIMEOUT_MS);
    }

    /* 3. 조도 센서 고장 (C2). 정상 값이 다시 들어오면 자동 해제 */
    status->ambient_light_sensor_fault = timeout[RX_LIGHT]
                                         || (in->ambient_light_lux < LUX_MIN)
                                         || (in->ambient_light_lux > LUX_MAX);

    /* 4. 강우 센서 고장 (C2) */
    status->rain_sensor_fault = timeout[RX_RAIN]
                                || (in->rain_level_pct < RAIN_MIN)
                                || (in->rain_level_pct > RAIN_MAX);

    /* 5. 속도 센서 고장 (C2, Q3): 내부 판정만, 출력하지 않음 */
    speed_sensor_fault = timeout[RX_SPEED]
                         || (in->vehicle_speed_kph < SPEED_MIN)
                         || (in->vehicle_speed_kph > SPEED_MAX);

    /* 6. 차량 상태 수신 중단 (C4) */
    status->vehicle_state_timeout = timeout[RX_SPEED] || timeout[RX_GEAR] || timeout[RX_IGNITION];

    /* 7. 유효한 속도 (C3): 셋 다 1회 이상 수신 + timeout 아님 + 속도 센서 고장 아님 */
    status->vehicle_speed_valid = rx[RX_SPEED].received
                                  && rx[RX_GEAR].received
                                  && rx[RX_IGNITION].received
                                  && !status->vehicle_state_timeout
                                  && !speed_sensor_fault;
}

/* FUN-COM-03 (04 '08_Common_CheckCont') */
bool Common_CheckContinuous(ContinuousTimer_t *timer, bool condition, uint32_t now_ms, uint32_t required_ms)
{
    if (timer == NULL) {
        return false;
    }

    /* 1. 조건이 깨지면 처음부터 다시 셈 (C1) */
    if (!condition) {
        timer->active = false;
        return false;
    }

    /* 2. 조건이 막 성립 */
    if (!timer->active) {
        timer->active   = true;
        timer->start_ms = now_ms;
    }

    /* 3. 경계값에 정확히 도달한 시점부터 성립 (C1, TIME-06·07) */
    return ((uint32_t)(now_ms - timer->start_ms) >= required_ms);
}
