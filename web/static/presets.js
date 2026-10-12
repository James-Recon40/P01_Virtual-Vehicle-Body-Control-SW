/*
 * presets.js - TC 사전조건 프리셋 (05 BlackBox TestCase v1.3 '사전조건' 열 기준)
 *
 * 프리셋 실행 순서 (app.js runPreset):
 *   1) reset: VehicleController_Init() 재호출, 시각 0 (이전 시험의 타이머·상태를 지움)
 *   2) stopAll이면 주기 신호 5개 모두 송신 중단 (03 개요 B8 시험 옵션), 아니면 5개 모두 송신
 *   3) steps를 차례로 실행
 *        { set: {신호: 값, ...} }  UI 컨트롤 값 변경 (주기 신호는 다음 100 ms 송신부터, 이벤트 신호는 즉시 송신)
 *        { stop: [신호, ...] }     해당 주기 신호 송신 중단
 *        { wait: ms }              대기 (사전조건의 'N초 이상 유지', 'N초 이상 경과')
 * 프리셋은 '사전조건'까지만 만든다. 테스트 절차와 판정은 시험자가 직접 한다.
 */
(function () {
  "use strict";

  // 대부분의 TC가 쓰는 기본 상태: 이벤트 신호 초기값 + 정차 상태
  var EVENTS_INIT = {
    light_switch: "OFF", wiper_switch: "OFF",
    door_fl_open: false, door_fr_open: false, door_rl_open: false, door_rr_open: false
  };
  function base(over) {
    var s = {
      ignition_on: true, vehicle_speed_kph: 0, gear_position: "P",
      ambient_light_lux: 5000, rain_level_pct: 0
    };
    var k;
    for (k in EVENTS_INIT) s[k] = EVENTS_INIT[k];
    for (k in over) s[k] = over[k];
    return s;
  }
  var SETTLE = 300; // 값이 VehicleController에 반영되도록 잠시 대기 (100 ms 송신 + 50 ms Step 여유)

  var P = {};

  // ---- 공통규칙 ----
  P["TC-C1-01"] = { steps: [{ set: base({}) }, { wait: 3000 + SETTLE }],
    note: "조도 5000 lux 3초 이상 유지" };
  P["TC-C1-02"] = { steps: [{ set: base({ light_switch: "AUTO" }) }, { wait: 3000 + SETTLE }],
    note: "조도 5000 lux 3초 이상 유지 → 전조등 꺼짐(L3)" };
  P["TC-C2-01"] = { steps: [{ set: base({ ambient_light_lux: 1000 }) }, { wait: SETTLE }] };
  P["TC-C2-02"] = { steps: [{ set: base({ vehicle_speed_kph: 50, gear_position: "D", ambient_light_lux: 500,
    rain_level_pct: 50, light_switch: "AUTO", wiper_switch: "AUTO" }) }, { wait: 1000 + SETTLE }],
    note: "조도 500 lux 1초 이상 → 전조등 켜짐(L2)" };
  P["TC-C3-01"] = { steps: [{ set: base({ vehicle_speed_kph: 50, gear_position: "D", door_fl_open: true }) },
    { wait: SETTLE }] };
  P["TC-C3-02"] = P["TC-C3-01"];
  P["TC-C4-01"] = { steps: [{ set: base({ vehicle_speed_kph: 20, gear_position: "D",
    light_switch: "ON", wiper_switch: "HIGH" }) }, { wait: SETTLE }] };
  P["TC-C4-02"] = { stopAll: true, steps: [],
    note: "프로그램 새로 시작 + 주기 신호 5개 모두 송신 중단 상태로 시작. 이벤트 신호는 초기값으로 1회 송신" };
  P["TC-C5-01"] = P["TC-C4-02"];
  P["TC-C5-02"] = P["TC-C4-02"];

  // ---- 조명 ----
  P["TC-L1-01"] = { steps: [{ set: base({ light_switch: "ON" }) }, { wait: SETTLE }] };
  P["TC-L1-02"] = { steps: [{ set: base({}) }, { stop: ["ambient_light_lux"] }, { wait: 500 + SETTLE }],
    note: "조도 송신 중단 후 0.5초 이상 경과 (C2 조도 센서 고장)" };
  P["TC-L5-01"] = { steps: [{ set: base({ ambient_light_lux: 0 }) }, { wait: SETTLE }] };
  P["TC-L5-02"] = { steps: [{ set: base({ ambient_light_lux: 60000 }) }, { wait: SETTLE }] };
  P["TC-L4-01"] = { steps: [{ set: base({}) }, { wait: SETTLE }] };
  P["TC-L4-02"] = { steps: [{ set: base({ ambient_light_lux: 500, light_switch: "ON" }) }, { wait: SETTLE }] };
  P["TC-L6-01"] = { steps: [{ set: base({ ambient_light_lux: 1200, light_switch: "AUTO" }) }, { wait: SETTLE }] };
  P["TC-L6-02"] = { steps: [{ set: base({ light_switch: "AUTO" }) }, { wait: 3000 + SETTLE }],
    note: "조도 5000 lux 3초 이상 유지 → 전조등 꺼짐(L3)" };
  P["TC-L2-01"] = P["TC-L6-02"];
  P["TC-L2-02"] = P["TC-L6-02"];
  P["TC-L3-01"] = { steps: [{ set: base({ ambient_light_lux: 500, light_switch: "AUTO" }) }, { wait: 1000 + SETTLE }],
    note: "조도 500 lux 1초 이상 유지 → 전조등 켜짐(L2)" };
  P["TC-L3-02"] = P["TC-L3-01"];

  // ---- 와이퍼 ----
  P["TC-W1-01"] = { steps: [{ set: base({ wiper_switch: "HIGH" }) }, { wait: SETTLE }] };
  P["TC-W1-02"] = { steps: [{ set: base({ ignition_on: false, rain_level_pct: 80 }) }, { wait: SETTLE }] };
  P["TC-W4-01"] = { steps: [{ set: base({}) }, { wait: SETTLE }] };
  P["TC-W4-02"] = P["TC-W4-01"];
  P["TC-W5-01"] = { steps: [{ set: base({ vehicle_speed_kph: 60, gear_position: "D" }) },
    { stop: ["rain_level_pct"] }, { wait: 500 + SETTLE }],
    note: "강우량 송신 중단 후 0.5초 이상 경과 (C2 강우 센서 고장)" };
  P["TC-W5-02"] = { steps: [{ set: base({ vehicle_speed_kph: 60, gear_position: "D", rain_level_pct: 80,
    wiper_switch: "AUTO" }) }, { wait: SETTLE }] };
  P["TC-W2-01"] = { steps: [{ set: base({ vehicle_speed_kph: 60, gear_position: "D", rain_level_pct: 9,
    wiper_switch: "AUTO" }) }, { wait: SETTLE }] };
  P["TC-W2-02"] = { steps: [{ set: base({ vehicle_speed_kph: 60, gear_position: "D", rain_level_pct: 69,
    wiper_switch: "AUTO" }) }, { wait: SETTLE }] };
  P["TC-W3-01"] = { steps: [{ set: base({ vehicle_speed_kph: 60, gear_position: "D", rain_level_pct: 80,
    wiper_switch: "AUTO" }) }, { wait: SETTLE }] };
  P["TC-W3-02"] = { steps: [{ set: base({ vehicle_speed_kph: 0, gear_position: "D", rain_level_pct: 80,
    wiper_switch: "AUTO" }) }, { wait: SETTLE }] };

  // ---- 도어·잠금·경고 ----
  P["TC-D1-01"] = { steps: [{ set: base({ vehicle_speed_kph: 20, gear_position: "D" }) }, { wait: SETTLE }],
    note: "20 km/h → 도어 잠금 잠김(D3)" };
  P["TC-D1-02"] = P["TC-D1-01"];
  P["TC-D2-01"] = { steps: [{ set: base({ vehicle_speed_kph: 20, gear_position: "D" }) }, { wait: SETTLE },
    { set: { vehicle_speed_kph: 0 } }, { wait: SETTLE }],
    note: "20 km/h로 잠근 뒤 0 km/h로 감속" };
  P["TC-D2-02"] = P["TC-D2-01"];
  P["TC-D3-01"] = { steps: [{ set: base({ gear_position: "P" }) }, { wait: SETTLE },
    { set: { gear_position: "D" } }, { wait: SETTLE }],
    note: "기어 P에서 D로 변경 → 도어 잠금 풀림" };
  P["TC-D3-02"] = P["TC-D1-01"];
  P["TC-D4-01"] = P["TC-D1-01"];
  P["TC-D4-02"] = { steps: [{ set: base({ vehicle_speed_kph: 1, gear_position: "D", door_fl_open: true }) },
    { wait: SETTLE }] };
  P["TC-D5-01"] = P["TC-D1-01"];
  P["TC-D5-02"] = P["TC-D1-01"];

  window.VBC_PRESETS = P;
})();
