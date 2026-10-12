/*
 * lighting_stub.c - [임시] UI 시연용 조명 스텁 (feature/ui 전용, 실제 기능 아님)
 * src/lighting/ 에 .c 파일이 없을 때만 web/server.py 가 링크한다. 실제 구현이 들어오면 자동으로 빠진다.
 * 동작: 항상 꺼짐(C5 초기값)을 반환한다. L1~L6 판단은 하지 않는다.
 */
#include "lighting.h"

void Lighting_Init(void)
{
}

bool Lighting_Update(bool ignition_on, LightSwitch_t light_switch, float ambient_light_lux,
                     WiperLevel_t wiper_level, const CommonStatus_t *status, uint32_t now_ms)
{
    (void)ignition_on;
    (void)light_switch;
    (void)ambient_light_lux;
    (void)wiper_level;
    (void)status;
    (void)now_ms;
    return false;
}
