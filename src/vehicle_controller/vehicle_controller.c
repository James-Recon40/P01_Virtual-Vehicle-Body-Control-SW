/*
 * vehicle_controller.c - UI와 기능 모듈 사이의 제어기
 * 근거: 04 SW 상세설계서 v1.1 시트 02_VC_Init, 03_VC_SetInputs, 04_VC_Step, 05_VC_GetOutputs
 *       03 인터페이스 정의서 v1.4 FUN-VC-01~04, TIME-02·04
 */
#include <stddef.h>

#include "vehicle_controller.h"
#include "common.h"
#include "wiper.h"
#include "lighting.h"
#include "door_lock.h"
#include "cluster_warning.h"

/* 04 '02_VC_Init' 내부 변수 */
static VehicleInputs_t  inputs;          /* UI에서 받은 최신 입력값 */
static uint16_t         pending_rx_mask; /* 직전 Step 이후 수신된 주기 신호 비트 */
static VehicleOutputs_t outputs;         /* 최근 완료된 출력 스냅샷 */
static uint32_t         current_time_ms; /* 현재 주기 시각 (SIG-020) */

static bool is_valid_gear(GearPosition_t gear)
{
    switch (gear) {
    case GEAR_P:
    case GEAR_R:
    case GEAR_N:
    case GEAR_D:
        return true;
    default:
        return false;
    }
}

static bool is_valid_light_switch(LightSwitch_t sw)
{
    switch (sw) {
    case LIGHT_SW_AUTO:
    case LIGHT_SW_OFF:
    case LIGHT_SW_ON:
        return true;
    default:
        return false;
    }
}

static bool is_valid_wiper_switch(WiperSwitch_t sw)
{
    switch (sw) {
    case WIPER_SW_OFF:
    case WIPER_SW_AUTO:
    case WIPER_SW_LOW:
    case WIPER_SW_HIGH:
        return true;
    default:
        return false;
    }
}

/* FUN-VC-01 (04 '02_VC_Init') */
void VehicleController_Init(void)
{
    /* 1. C5 */
    current_time_ms = 0u;
    pending_rx_mask = 0u;

    /* 2. 입력 초기값: 03 v1.4 SIG-001~011 Initial Value (C5) */
    inputs.vehicle_speed_kph = 0.0f;
    inputs.gear_position     = GEAR_P;
    inputs.ignition_on       = false;
    inputs.ambient_light_lux = 0.0f;
    inputs.rain_level_pct    = 0.0f;
    inputs.door_fl_open      = false;
    inputs.door_fr_open      = false;
    inputs.door_rl_open      = false;
    inputs.door_rr_open      = false;
    inputs.light_switch      = LIGHT_SW_OFF;
    inputs.wiper_switch      = WIPER_SW_OFF;

    /* 3. 모듈 초기화 (C5) */
    Common_Init(current_time_ms);
    Wiper_Init();
    Lighting_Init();
    DoorLock_Init();
    ClusterWarning_Init();

    /* 4. 출력 스냅샷 초기값 (C5, Q1: 센서 고장 표시는 정상으로 시작) */
    outputs.vehicle_speed_valid        = false;
    outputs.vehicle_state_timeout      = false;
    outputs.ambient_light_sensor_fault = false;
    outputs.rain_sensor_fault          = false;
    outputs.headlamp_on                = false;
    outputs.wiper_level                = WIPER_LEVEL_STOP;
    outputs.door_locked                = false;
    outputs.cluster_warning            = CLUSTER_WARNING_NONE;
}

/* FUN-VC-02 (04 '03_VC_SetInputs') */
void VehicleController_SetInputs(const VehicleInputs_t *in, uint16_t signal_mask)
{
    uint16_t valid_mask = 0u;

    /* 1. */
    if (in == NULL) {
        return;
    }

    /* 2. mask에 표시된 신호만 저장. 범위 밖 값도 그대로 저장 (판정은 Common_Update, C2·C3) */
    if ((signal_mask & INPUT_SIG_SPEED) != 0u) {
        inputs.vehicle_speed_kph = in->vehicle_speed_kph;
        valid_mask |= INPUT_SIG_SPEED;
    }
    /* 3. enum 신호가 정의된 값이 아니면 저장하지 않고 수신으로도 보지 않음 */
    if (((signal_mask & INPUT_SIG_GEAR) != 0u) && is_valid_gear(in->gear_position)) {
        inputs.gear_position = in->gear_position;
        valid_mask |= INPUT_SIG_GEAR;
    }
    if ((signal_mask & INPUT_SIG_IGNITION) != 0u) {
        inputs.ignition_on = in->ignition_on;
        valid_mask |= INPUT_SIG_IGNITION;
    }
    if ((signal_mask & INPUT_SIG_LIGHT) != 0u) {
        inputs.ambient_light_lux = in->ambient_light_lux;
        valid_mask |= INPUT_SIG_LIGHT;
    }
    if ((signal_mask & INPUT_SIG_RAIN) != 0u) {
        inputs.rain_level_pct = in->rain_level_pct;
        valid_mask |= INPUT_SIG_RAIN;
    }
    if ((signal_mask & INPUT_SIG_DOOR_FL) != 0u) {
        inputs.door_fl_open = in->door_fl_open;
    }
    if ((signal_mask & INPUT_SIG_DOOR_FR) != 0u) {
        inputs.door_fr_open = in->door_fr_open;
    }
    if ((signal_mask & INPUT_SIG_DOOR_RL) != 0u) {
        inputs.door_rl_open = in->door_rl_open;
    }
    if ((signal_mask & INPUT_SIG_DOOR_RR) != 0u) {
        inputs.door_rr_open = in->door_rr_open;
    }
    if (((signal_mask & INPUT_SIG_LIGHT_SW) != 0u) && is_valid_light_switch(in->light_switch)) {
        inputs.light_switch = in->light_switch;
    }
    if (((signal_mask & INPUT_SIG_WIPER_SW) != 0u) && is_valid_wiper_switch(in->wiper_switch)) {
        inputs.wiper_switch = in->wiper_switch;
    }

    /* 4. 주기 신호만 수신 표시. 수신 시각은 다음 Step에서 current_time_ms로 기록 (C2~C4, TIME-04)
     *    이벤트 신호는 Timeout 감시 대상이 아니므로 표시하지 않음 (03 SIG-006~011) */
    pending_rx_mask |= (uint16_t)(valid_mask & INPUT_SIG_PERIODIC_MASK);
}

/* FUN-VC-03 (04 '04_VC_Step') */
void VehicleController_Step(uint32_t now_ms)
{
    CommonStatus_t   status;
    WiperLevel_t     wiper_level;
    bool             headlamp_on;
    bool             door_locked;
    ClusterWarning_t cluster_warning;

    /* 1. 주기 시작: 이 주기 안에서는 이 시각만 사용 (TIME-04) */
    current_time_ms = now_ms;

    /* 2. ① 공통 규칙 (C2, C3, C4) */
    Common_Update(&inputs, pending_rx_mask, current_time_ms, &status);
    pending_rx_mask = 0u;

    /* 3. ② 와이퍼 (W1~W5) */
    wiper_level = Wiper_Update(inputs.ignition_on, inputs.wiper_switch, inputs.rain_level_pct,
                               inputs.vehicle_speed_kph, &status);

    /* 4. ③ 조명 (C1, L1~L6): 이번 주기 와이퍼 결과를 전달 (L6) */
    headlamp_on = Lighting_Update(inputs.ignition_on, inputs.light_switch, inputs.ambient_light_lux,
                                  wiper_level, &status, current_time_ms);

    /* 5. ④ 도어 잠금 (D1~D3) */
    door_locked = DoorLock_Update(inputs.ignition_on, inputs.gear_position, inputs.vehicle_speed_kph,
                                  &status);

    /* 6. ⑤ 계기판 경고 (D4, D5) */
    cluster_warning = ClusterWarning_Update(inputs.vehicle_speed_kph, inputs.door_fl_open,
                                            inputs.door_fr_open, inputs.door_rl_open,
                                            inputs.door_rr_open, &status);

    /* 7. 출력 모음 (SIG-012~019) */
    outputs.vehicle_speed_valid        = status.vehicle_speed_valid;
    outputs.vehicle_state_timeout      = status.vehicle_state_timeout;
    outputs.ambient_light_sensor_fault = status.ambient_light_sensor_fault;
    outputs.rain_sensor_fault          = status.rain_sensor_fault;
    outputs.headlamp_on                = headlamp_on;
    outputs.wiper_level                = wiper_level;
    outputs.door_locked                = door_locked;
    outputs.cluster_warning            = cluster_warning;
}

/* FUN-VC-04 (04 '05_VC_GetOutputs') */
void VehicleController_GetOutputs(VehicleOutputs_t *out)
{
    /* 1. */
    if (out == NULL) {
        return;
    }
    /* 2. 마지막으로 완료된 스냅샷 전체 복사 (SIG-012~019) */
    *out = outputs;
}
