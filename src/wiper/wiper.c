/*
 * wiper.c - 와이퍼 W1~W5
 * 근거: 04 SW 상세설계서 v1.1 시트 09_Wiper_Init, 10_Wiper_Update
 *       03 인터페이스 정의서 v1.4 FUN-WIP-01~02
 * 우선순위 W1 > W4 > W5 > W2·W3
 */
#include "wiper.h"

/* FUN-WIP-01 (04 '09_Wiper_Init') */
void Wiper_Init(void)
{
    /* 1. 내부에 보관하는 상태가 없음. 시작 직후 와이퍼 동작 상태는 VC 출력 초기값 WIPER_LEVEL_STOP (C5) */
}

/* FUN-WIP-02 (04 '10_Wiper_Update') */
WiperLevel_t Wiper_Update(bool ignition_on, WiperSwitch_t wiper_switch, float rain_level_pct,
                          float vehicle_speed_kph, const CommonStatus_t *status)
{
    WiperLevel_t level;

    /* 1. 시동 꺼짐 또는 차량 상태 수신 중단이면 정지 (W1, C4) */
    if (!ignition_on || status->vehicle_state_timeout) {
        return WIPER_LEVEL_STOP;
    }

    /* 2. 스위치 OFF → 정지, LOW → 저속, HIGH → 고속 (W4) */
    if (wiper_switch == WIPER_SW_OFF) {
        return WIPER_LEVEL_STOP;
    }
    if (wiper_switch == WIPER_SW_LOW) {
        return WIPER_LEVEL_LOW;
    }
    if (wiper_switch == WIPER_SW_HIGH) {
        return WIPER_LEVEL_HIGH;
    }

    /* 3. (AUTO) 강우 센서 고장이면 간헐. 고장 표시는 Common이 만든다 (W5, SIG-015) */
    if (status->rain_sensor_fault) {
        return WIPER_LEVEL_INT;
    }

    /* 4. (AUTO) 강우량 단계: < 10 → STOP, < 40 → INT, < 70 → LOW, 그 외 → HIGH (W2) */
    if (rain_level_pct < RAIN_INT_THRESHOLD) {
        level = WIPER_LEVEL_STOP;
    } else if (rain_level_pct < RAIN_LOW_THRESHOLD) {
        level = WIPER_LEVEL_INT;
    } else if (rain_level_pct < RAIN_HIGH_THRESHOLD) {
        level = WIPER_LEVEL_LOW;
    } else {
        level = WIPER_LEVEL_HIGH;
    }

    /* 5. 유효한 속도 + 속도 0 km/h이면 한 단계 낮춤, STOP은 그대로 (W3, C3)
     *    속도 0 판정은 <= 0.0f (유효한 속도는 0~250이므로 0과 같음, 실수 == 비교 회피) */
    if (status->vehicle_speed_valid && (vehicle_speed_kph <= SPEED_MIN) && (level != WIPER_LEVEL_STOP)) {
        level = (WiperLevel_t)(level - 1);
    }

    /* 6. (W2, W3) */
    return level;
}
