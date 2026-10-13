/*
 * vehicle_controller.h - UI와 기능 모듈 사이의 제어기 (모든 값 전달은 VC를 거침)
 * 근거: 04 SW 상세설계서 v1.1 시트 02~05, 18, 03 FUN-VC-01~04
 * 구현(vehicle_controller.c): feature/vehicle-controller
 */
#ifndef VEHICLE_CONTROLLER_H
#define VEHICLE_CONTROLLER_H

#include "vbc_types.h"

/* FUN-VC-01: 프로그램 시작 시 1회. 입력·출력·시간과 모든 모듈 초기화 (C5) */
void VehicleController_Init(void);

/* FUN-VC-02: UI 입력 수신 시. signal_mask(INPUT_SIG_*)에 표시된 신호만 저장 */
void VehicleController_SetInputs(const VehicleInputs_t *in, uint16_t signal_mask);

/* FUN-VC-03: 50 ms마다 1회. now_ms = 스케줄러가 읽은 프로그램 시작 후 경과 시간 */
void VehicleController_Step(uint32_t now_ms);

/* FUN-VC-04: 최근 완료된 출력 스냅샷 (SIG-012~019) */
void VehicleController_GetOutputs(VehicleOutputs_t *out);

#endif /* VEHICLE_CONTROLLER_H */
