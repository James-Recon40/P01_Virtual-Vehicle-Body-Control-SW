/*
 * common.h - 공통 규칙 C1~C4 (센서 고장, 유효한 속도, 수신 중단, N초 연속)
 * 근거: 04 SW 상세설계서 v1.1 시트 06~08, 03 FUN-COM-01~03
 * 구현(common.c): feature/common
 */
#ifndef COMMON_H
#define COMMON_H

#include "vbc_types.h"

/* FUN-COM-01: 수신 관리와 공통 판정 상태 초기화 (VehicleController_Init 안에서 1회, now_ms = 0) */
void Common_Init(uint32_t now_ms);

/* FUN-COM-02: 수신 기록 갱신 후 C2·C3·C4 판정 (VehicleController_Step 1번째, 50 ms마다) */
void Common_Update(const VehicleInputs_t *in, uint16_t rx_mask, uint32_t now_ms, CommonStatus_t *status);

/* FUN-COM-03: 조건이 required_ms 동안 끊기지 않고 성립했는지 판정 (C1, Lighting_Update에서 호출) */
bool Common_CheckContinuous(ContinuousTimer_t *timer, bool condition, uint32_t now_ms, uint32_t required_ms);

#endif /* COMMON_H */
