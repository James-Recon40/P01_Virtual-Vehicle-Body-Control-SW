/*
 * vbc_bridge.c - web/server.py(ctypes)가 C 구조체 배치를 확인하는 보조 함수
 * VehicleController 동작에는 관여하지 않는다.
 */
#include <stddef.h>

#include "vbc_types.h"

#define BRIDGE_FIELD(type, field) ((uint32_t)offsetof(type, field))

uint32_t Bridge_SizeofInputs(void)
{
    return (uint32_t)sizeof(VehicleInputs_t);
}

uint32_t Bridge_SizeofOutputs(void)
{
    return (uint32_t)sizeof(VehicleOutputs_t);
}

/* VehicleInputs_t 필드 11개의 offset을 선언 순서대로 out[0..10]에 채운다 */
void Bridge_InputOffsets(uint32_t *out)
{
    out[0]  = BRIDGE_FIELD(VehicleInputs_t, vehicle_speed_kph);
    out[1]  = BRIDGE_FIELD(VehicleInputs_t, gear_position);
    out[2]  = BRIDGE_FIELD(VehicleInputs_t, ignition_on);
    out[3]  = BRIDGE_FIELD(VehicleInputs_t, ambient_light_lux);
    out[4]  = BRIDGE_FIELD(VehicleInputs_t, rain_level_pct);
    out[5]  = BRIDGE_FIELD(VehicleInputs_t, door_fl_open);
    out[6]  = BRIDGE_FIELD(VehicleInputs_t, door_fr_open);
    out[7]  = BRIDGE_FIELD(VehicleInputs_t, door_rl_open);
    out[8]  = BRIDGE_FIELD(VehicleInputs_t, door_rr_open);
    out[9]  = BRIDGE_FIELD(VehicleInputs_t, light_switch);
    out[10] = BRIDGE_FIELD(VehicleInputs_t, wiper_switch);
}

/* VehicleOutputs_t 필드 8개의 offset을 선언 순서대로 out[0..7]에 채운다 */
void Bridge_OutputOffsets(uint32_t *out)
{
    out[0] = BRIDGE_FIELD(VehicleOutputs_t, vehicle_speed_valid);
    out[1] = BRIDGE_FIELD(VehicleOutputs_t, vehicle_state_timeout);
    out[2] = BRIDGE_FIELD(VehicleOutputs_t, ambient_light_sensor_fault);
    out[3] = BRIDGE_FIELD(VehicleOutputs_t, rain_sensor_fault);
    out[4] = BRIDGE_FIELD(VehicleOutputs_t, headlamp_on);
    out[5] = BRIDGE_FIELD(VehicleOutputs_t, wiper_level);
    out[6] = BRIDGE_FIELD(VehicleOutputs_t, door_locked);
    out[7] = BRIDGE_FIELD(VehicleOutputs_t, cluster_warning);
}
