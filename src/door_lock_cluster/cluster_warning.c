/*
 * cluster_warning.c - 계기판 경고 D4~D5
 * 근거: 04 SW 상세설계서 v1.1 시트 15_Cluster_Init, 16_Cluster_Update
 *       03 인터페이스 정의서 v1.4 FUN-CLU-01~02
 */
#include "cluster_warning.h"

/* FUN-CLU-01 (04 '15_Cluster_Init') */
void ClusterWarning_Init(void)
{
    /* 1. 보관하는 상태 없음. 시작 경고는 VC 출력 초기값 CLUSTER_WARNING_NONE (C5) */
}

/* FUN-CLU-02 (04 '16_Cluster_Update')
 * 우선순위: 주행 중 도어 열림 > 조도 센서 고장 > 강우 센서 고장 (D5) */
ClusterWarning_t ClusterWarning_Update(float vehicle_speed_kph, bool door_fl_open, bool door_fr_open,
                                       bool door_rl_open, bool door_rr_open, const CommonStatus_t *status)
{
    /* 1. 도어 4개 중 하나라도 열림 (D4) */
    bool any_door_open = door_fl_open || door_fr_open || door_rl_open || door_rr_open;

    /* 2. 유효한 속도 + 속도 > 0 + 도어 열림 → 주행 중 도어 열림 (D4, D5, C3)
     *    수신 중단이면 유효한 속도가 아니므로 표시하지 않음 */
    if (status->vehicle_speed_valid && (vehicle_speed_kph > SPEED_MIN) && any_door_open) {
        return CLUSTER_WARNING_DOOR_OPEN;
    }
    /* 3. 조도 센서 고장 (D5) */
    if (status->ambient_light_sensor_fault) {
        return CLUSTER_WARNING_AMBIENT_SENSOR;
    }
    /* 4. 강우 센서 고장 (D5) */
    if (status->rain_sensor_fault) {
        return CLUSTER_WARNING_RAIN_SENSOR;
    }
    /* 5. 해당 없음 (D5) */
    return CLUSTER_WARNING_NONE;
}
