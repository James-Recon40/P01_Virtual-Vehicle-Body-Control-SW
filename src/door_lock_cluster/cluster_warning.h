/*
 * cluster_warning.h - 계기판 경고 D4~D5
 * 근거: 04 SW 상세설계서 v1.1 시트 15~16, 03 FUN-CLU-01~02
 * 구현(cluster_warning.c): feature/door-lock-cluster
 */
#ifndef CLUSTER_WARNING_H
#define CLUSTER_WARNING_H

#include "vbc_types.h"

/* FUN-CLU-01: VehicleController_Init 안에서 1회 */
void ClusterWarning_Init(void);

/* FUN-CLU-02: VehicleController_Step 5번째, 50 ms마다
 * 우선순위: 주행 중 도어 열림 > 조도 센서 고장 > 강우 센서 고장 */
ClusterWarning_t ClusterWarning_Update(float vehicle_speed_kph, bool door_fl_open, bool door_fr_open,
                                       bool door_rl_open, bool door_rr_open, const CommonStatus_t *status);

#endif /* CLUSTER_WARNING_H */
