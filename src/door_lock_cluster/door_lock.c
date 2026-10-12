/*
 * door_lock.c - 도어 잠금 D1~D3
 * 근거: 04 SW 상세설계서 v1.1 시트 13_DoorLock_Init, 14_DoorLock_Update
 *       03 인터페이스 정의서 v1.4 FUN-DLK-01~02
 */
#include "door_lock.h"

/* 04 '14_DoorLock_Update' 내부 변수: 현재 도어 잠금 상태 (SIG-018) */
static bool door_locked = false;

/* FUN-DLK-01 (04 '13_DoorLock_Init') */
void DoorLock_Init(void)
{
    /* 1. 잠금 해제로 시작 (C5) */
    door_locked = false;
}

/* FUN-DLK-02 (04 '14_DoorLock_Update') */
bool DoorLock_Update(bool ignition_on, GearPosition_t gear_position, float vehicle_speed_kph,
                     const CommonStatus_t *status)
{
    if (status->vehicle_state_timeout) {
        /* 1. 차량 상태 수신 중단 → 직전 상태 유지 (D1, C4) */
    } else if (!ignition_on || (gear_position == GEAR_P)) {
        /* 2. 시동 꺼짐 또는 기어 P → 잠금 해제 (D2) */
        door_locked = false;
    } else if (status->vehicle_speed_valid && (vehicle_speed_kph >= DOOR_LOCK_SPEED_KPH)) {
        /* 3. 유효한 속도 15 km/h 이상 → 잠금 (D3, C3) */
        door_locked = true;
    } else {
        /* 4. D1~D3 미해당 → 직전 상태 유지 (D3) */
    }

    /* 5. SIG-018 */
    return door_locked;
}
