/*
 * lighting.h - 전조등 L1~L6
 * 근거: 04 SW 상세설계서 v1.1 시트 11~12, 03 FUN-LGT-01~02
 * 구현(lighting.c): feature/lighting
 */
#ifndef LIGHTING_H
#define LIGHTING_H

#include "vbc_types.h"

/* FUN-LGT-01: VehicleController_Init 안에서 1회 */
void Lighting_Init(void);

/* FUN-LGT-02: VehicleController_Step 3번째(Wiper 이후, DoorLock 이전), 50 ms마다
 * 우선순위 L1 > L5 > L4 > L6 > L2·L3. wiper_level은 이번 주기 Wiper_Update 결과 */
bool Lighting_Update(bool ignition_on, LightSwitch_t light_switch, float ambient_light_lux,
                     WiperLevel_t wiper_level, const CommonStatus_t *status, uint32_t now_ms);

#endif /* LIGHTING_H */
