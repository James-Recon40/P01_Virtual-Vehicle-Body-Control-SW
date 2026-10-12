/*
 * wiper.h - 와이퍼 W1~W5
 * 근거: 04 SW 상세설계서 v1.1 시트 09~10, 03 FUN-WIP-01~02
 * 구현(wiper.c): feature/wiper
 */
#ifndef WIPER_H
#define WIPER_H

#include "vbc_types.h"

/* FUN-WIP-01: VehicleController_Init 안에서 1회 */
void Wiper_Init(void);

/* FUN-WIP-02: VehicleController_Step 2번째(Common 이후, Lighting 이전), 50 ms마다
 * 우선순위 W1 > W4 > W5 > W2·W3 */
WiperLevel_t Wiper_Update(bool ignition_on, WiperSwitch_t wiper_switch, float rain_level_pct,
                          float vehicle_speed_kph, const CommonStatus_t *status);

#endif /* WIPER_H */
