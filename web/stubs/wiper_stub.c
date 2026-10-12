/*
 * wiper_stub.c - [임시] UI 시연용 와이퍼 스텁 (feature/ui 전용, 실제 기능 아님)
 * src/wiper/ 에 .c 파일이 없을 때만 web/server.py 가 링크한다. 실제 구현이 들어오면 자동으로 빠진다.
 * 동작: 항상 정지(C5 초기값)를 반환한다. W1~W5 판단은 하지 않는다.
 */
#include "wiper.h"

void Wiper_Init(void)
{
}

WiperLevel_t Wiper_Update(bool ignition_on, WiperSwitch_t wiper_switch, float rain_level_pct,
                          float vehicle_speed_kph, const CommonStatus_t *status)
{
    (void)ignition_on;
    (void)wiper_switch;
    (void)rain_level_pct;
    (void)vehicle_speed_kph;
    (void)status;
    return WIPER_LEVEL_STOP;
}
