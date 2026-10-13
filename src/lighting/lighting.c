/*
 * lighting.c - 전조등 L1~L6
 * 근거: 04 SW 상세설계서 v1.1 시트 11_Lighting_Init, 12_Lighting_Update
 *       03 인터페이스 정의서 v1.4 FUN-LGT-01~02, TIMER-01~03
 * 우선순위 L1 > L5 > L4 > L6 > L2·L3
 * 예외: 공통 계산 함수 Common_CheckContinuous()만 직접 호출한다 (C1)
 */
#include "lighting.h"
#include "common.h"

static bool              headlamp_on;  /* 현재 전조등 상태, 직전 상태 유지에 사용 (L3, Q2) */
static ContinuousTimer_t dark_timer;   /* TIMER-01: L2 조도 < 1000 lux 연속 시간 */
static ContinuousTimer_t bright_timer; /* TIMER-02: L3 조도 > 1500 lux 연속 시간 */
static ContinuousTimer_t wiper_timer;  /* TIMER-03: L6 와이퍼 작동 연속 시간 (조명 스위치와 무관) */

/* FUN-LGT-01 (04 '11_Lighting_Init') */
void Lighting_Init(void)
{
    /* 1. (C5) */
    headlamp_on = false;

    /* 2. 타이머 3개 비활성 (C1) */
    dark_timer.active   = false;
    dark_timer.start_ms = 0u;
    bright_timer.active   = false;
    bright_timer.start_ms = 0u;
    wiper_timer.active   = false;
    wiper_timer.start_ms = 0u;
}

/* FUN-LGT-02 (04 '12_Lighting_Update') */
bool Lighting_Update(bool ignition_on, LightSwitch_t light_switch, float ambient_light_lux,
                     WiperLevel_t wiper_level, const CommonStatus_t *status, uint32_t now_ms)
{
    bool ign;
    bool is_auto;
    bool sensor_ok;
    bool l2;
    bool l3;
    bool l6;

    /* 1. 실효 시동: 수신 중단이면 시동 꺼짐으로 봄 (C4) */
    ign = ignition_on && !status->vehicle_state_timeout;

    /* 2. 시간 조건은 우선순위와 관계없이 항상 먼저 계산 (C1, TIMER-01~03) */
    is_auto   = (light_switch == LIGHT_SW_AUTO);
    sensor_ok = !status->ambient_light_sensor_fault;
    l2 = Common_CheckContinuous(&dark_timer,
                                ign && is_auto && sensor_ok && (ambient_light_lux < LUX_DARK_THRESHOLD),
                                now_ms, L2_DARK_TIME_MS);
    l3 = Common_CheckContinuous(&bright_timer,
                                ign && is_auto && sensor_ok && (ambient_light_lux > LUX_BRIGHT_THRESHOLD),
                                now_ms, L3_BRIGHT_TIME_MS);
    l6 = Common_CheckContinuous(&wiper_timer,
                                ign && (wiper_level != WIPER_LEVEL_STOP),
                                now_ms, L6_WIPER_TIME_MS);

    if (!ign) {
        /* 3. 시동 꺼짐 → 꺼짐 (L1) */
        headlamp_on = false;
    } else if (status->ambient_light_sensor_fault) {
        /* 4. 조도 센서 고장 → 켜짐. 고장 표시는 Common이 만든다 (L5, SIG-014) */
        headlamp_on = true;
    } else if (light_switch == LIGHT_SW_ON) {
        /* 5. 스위치 ON → 켜짐 (L4) */
        headlamp_on = true;
    } else if (light_switch == LIGHT_SW_OFF) {
        /* 5. 스위치 OFF → 꺼짐 (L4) */
        headlamp_on = false;
    } else if (l6) {
        /* 6. (AUTO) 와이퍼 10초 연속 작동 → 켜짐, 작동하는 동안 유지 (L6) */
        headlamp_on = true;
    } else if (l2) {
        /* 7. (AUTO) 조도 < 1000 lux 1초 연속 → 켜짐 (L2) */
        headlamp_on = true;
    } else if (l3) {
        /* 8. (AUTO) 조도 > 1500 lux 3초 연속 → 꺼짐 (L3) */
        headlamp_on = false;
    } else {
        /* 9. 어느 규칙도 해당 없음 → 직전 값 유지 (L3, Q2) */
    }

    /* 10. (SIG-016) */
    return headlamp_on;
}
