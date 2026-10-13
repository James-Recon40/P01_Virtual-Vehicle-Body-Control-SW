/*
 * door_lock.h - 도어 잠금 D1~D3
 * 근거: 04 SW 상세설계서 v1.1 시트 13~14, 03 FUN-DLK-01~02
 * 구현(door_lock.c): feature/door-lock-cluster
 */
#ifndef DOOR_LOCK_H
#define DOOR_LOCK_H

#include "vbc_types.h"

/* FUN-DLK-01: VehicleController_Init 안에서 1회 */
void DoorLock_Init(void);

/* FUN-DLK-02: VehicleController_Step 4번째(Lighting 이후, ClusterWarning 이전), 50 ms마다
 * D1 → D2 → D3 순서로 판단 */
bool DoorLock_Update(bool ignition_on, GearPosition_t gear_position, float vehicle_speed_kph,
                     const CommonStatus_t *status);

#endif /* DOOR_LOCK_H */
