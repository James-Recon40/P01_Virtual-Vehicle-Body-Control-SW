/*
 * app.js - VBC 웹 UI (feature/ui)
 * 근거: 04 SW 상세설계서 v1.1 '18_UI_연동', 03 인터페이스 정의서 v1.4 개요 B7~B10
 *
 * - 주기 신호 5개: 100 ms마다 한 메시지로 송신. 송신 중단한 신호는 메시지에서 뺀다 (B7, B8)
 * - 이벤트 신호 6개: 값이 바뀔 때 바뀐 신호만 송신. 시작·재연결 시 6개 현재값을 1회 송신 (B7, B9)
 * - 화면 초기값은 03 SIG-001~011 Initial Value와 같다
 * - 조도·강우량은 유효 범위 밖 값도 그대로 보낸다 (C2 시험용, 18 시트)
 * - 속도는 '현실 주행'으로 만든다 (아래 '현실 주행' 절). 범위 밖 속도는 '속도 센서 고장 주입'으로 그대로 보낸다
 */
(function () {
  "use strict";

  var PERIODIC = ["vehicle_speed_kph", "gear_position", "ignition_on", "ambient_light_lux", "rain_level_pct"];
  var EVENTS = ["door_fl_open", "door_fr_open", "door_rl_open", "door_rr_open", "light_switch", "wiper_switch"];
  var TX_PERIOD_MS = 100;
  var RX_TIMEOUT_MS = 500; // vbc_types.h RX_TIMEOUT_MS (C2·C4), 기록 이유 표시용

  var LABEL = {
    vehicle_speed_kph: "속도", gear_position: "기어", ignition_on: "시동", ambient_light_lux: "조도",
    rain_level_pct: "강우량", door_fl_open: "도어 FL", door_fr_open: "도어 FR", door_rl_open: "도어 RL",
    door_rr_open: "도어 RR", light_switch: "조명 스위치", wiper_switch: "와이퍼 스위치"
  };
  var VALID_RANGE = {
    vehicle_speed_kph: [0, 250], ambient_light_lux: [0, 60000], rain_level_pct: [0, 100]
  };
  var WIPER_TEXT = { STOP: "정지", INT: "간헐", LOW: "저속", HIGH: "고속" };
  var WARNING_TEXT = {
    NONE: "경고 없음", DOOR_OPEN: "주행 중 도어 열림", AMBIENT_SENSOR: "조도 센서 고장", RAIN_SENSOR: "강우 센서 고장"
  };

  // 03 SIG-001~011 Initial Value (C5)
  var inputs = {
    vehicle_speed_kph: 0, gear_position: "P", ignition_on: false, ambient_light_lux: 0, rain_level_pct: 0,
    door_fl_open: false, door_fr_open: false, door_rl_open: false, door_rr_open: false,
    light_switch: "OFF", wiper_switch: "OFF"
  };
  var txEnabled = {};
  PERIODIC.forEach(function (s) { txEnabled[s] = true; });

  var ws = null;
  var connected = false;
  var lastOut = null;
  var lastTime = null;
  var markerTime = null;
  var resetWaiters = [];
  var presetRunning = false;
  var outputWaiters = []; // 자동 시험: 조건을 만족하는 출력 메시지를 기다린다
  var stopWatch = {};      // 송신 중단한 주기 신호 → { t: 중단을 누른 time_ms, row: '송신 중단' 기록 행 }
  var noRxWarned = false;  // 서버가 rx 필드를 보내지 않음 (이전 버전) 안내 1회

  var $ = function (id) { return document.getElementById(id); };

  // ================================================================ 통신
  function connect() {
    var proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws");
    ws.onopen = function () {
      connected = true;
      noRxWarned = false;
      setConn(true);
      log("sys", "연결됨");
      sendEventsOnce("연결"); // B9
    };
    ws.onclose = function () {
      if (connected) log("sys", "연결 끊김 - 1초 후 다시 연결");
      connected = false;
      setConn(false);
      setTimeout(connect, 1000);
    };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === "output") onOutput(msg);
      else if (msg.type === "hello") onHello(msg);
      else if (msg.type === "reset_done") onResetDone();
    };
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  function sendInput(signals, kind) {
    if (!send({ type: "input", signals: signals })) return;
    if (kind) log("in", kind + " " + JSON.stringify(signals));
  }

  function sendEventsOnce(reason) {
    var s = {};
    EVENTS.forEach(function (k) { s[k] = inputs[k]; });
    sendInput(s, "이벤트 신호 6개 1회 송신(" + reason + ")");
  }

  // 주기 신호: 100 ms마다, 값이 같아도 계속 (B7)
  setInterval(function () {
    if (!connected) return;
    var s = {};
    var n = 0;
    PERIODIC.forEach(function (k) {
      if (txEnabled[k]) { s[k] = inputs[k]; n++; }
    });
    if (n === 0) return;
    sendInput(s, $("opt-log-periodic").checked ? "주기" : null);
  }, TX_PERIOD_MS);

  function onHello(msg) {
    var badge = $("stub-badge");
    if (msg.stubs && msg.stubs.length) {
      var names = msg.stubs.map(function (m) { return m === "wiper" ? "와이퍼" : m === "lighting" ? "조명" : m; });
      badge.textContent = "[임시] 스텁: " + names.join(", ") + " (실제 구현 아님)";
      badge.title = "src/에 해당 모듈 .c가 아직 없어 항상 초기값(정지/꺼짐)을 반환하는 임시 스텁을 쓰고 있습니다.";
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function requestReset(reason) {
    return new Promise(function (resolve, reject) {
      if (!send({ type: "reset" })) { reject(new Error("연결 안 됨")); return; }
      log("sys", "새로 시작 요청 (" + reason + ")");
      var timer = setTimeout(function () { reject(new Error("응답 없음")); }, 3000);
      resetWaiters.push(function () { clearTimeout(timer); resolve(); });
    });
  }

  function onResetDone() {
    stopWatch = {};
    lastOut = null;
    lastTime = 0;
    markerTime = null;
    $("time-ms").textContent = "0";
    renderMarker();
    log("sys", "VehicleController_Init() 완료, time_ms = 0부터 다시 시작");
    var waiters = resetWaiters;
    resetWaiters = [];
    waiters.forEach(function (w) { w(); });
  }

  // ================================================================ 현실 주행 (UI 전용, VBC 요구사항 아님)
  // 속도 슬라이더는 목표 속도다. 실제 속도는 기어·시동에 따라 서서히 바뀌고, 그 값을 속도 신호로 보낸다.
  // - 기어 P·R은 정지(속도 0)일 때만 들어가고 나올 수 있다. D↔N은 주행 중에도 된다
  // - 시동이 꺼져 있으면 기어를 바꿀 수 없다. 시동은 주행 중에 끌 수 없다
  // - D·R(시동 켜짐): 목표 속도까지 가속·감속한다. R은 최대 REVERSE_MAX
  // - N·시동 꺼짐: 가속하지 않는다. 목표가 현재보다 낮으면 브레이크, 아니면 관성으로 천천히 감속
  // - 범위 밖 속도(-1, 251 등)는 '속도 센서 고장 주입': 실제 속도와 별개로 그 값을 그대로 보낸다 (C3 범위 판정 시험)
  // - 도어 잠금 출력이 잠김(D3)이면 닫힌 문을 열 수 없다. 열린 문은 언제든 닫을 수 있다
  // - TC 사전조건 적용은 이 규칙을 거치지 않고 값을 바로 세팅한다. 그 뒤로는 이 규칙대로 움직인다
  var DRIVE = { ACCEL: 10, BRAKE: 20, COAST: 2, REVERSE_MAX: 20, TICK_MS: 50 }; // km/h/s, ms
  var drive = { speed: 0, target: 0, fault: null };
  var driveMsgTimer = null;

  function gearBlocked(to) {
    var from = inputs.gear_position;
    if (from === to) return null;
    if (!inputs.ignition_on) return "시동이 꺼져 있으면 기어를 바꿀 수 없습니다";
    if (drive.speed <= 0) return null;
    if (from === "P" || to === "P" || from === "R" || to === "R") {
      return "주행 중에는 기어 " + from + " → " + to + " 변경 불가 (P·R은 정지 상태에서만)";
    }
    return null;
  }

  function ignitionBlocked(on) {
    return !on && inputs.ignition_on && drive.speed > 0 ? "주행 중에는 시동을 끌 수 없습니다" : null;
  }

  function doorBlocked(name) {
    return !inputs[name] && lastOut && lastOut.door_locked ? "도어 잠금이 잠김 상태라 문을 열 수 없습니다 (D3)" : null;
  }

  function notifyDrive(text) {
    var el = $("drive-msg");
    el.textContent = text;
    el.classList.add("show");
    log("sys", "막힘: " + text);
    clearTimeout(driveMsgTimer);
    driveMsgTimer = setTimeout(function () { el.textContent = ""; el.classList.remove("show"); }, 3000);
  }

  // 사용자가 누른 시동·기어: 현실 주행 규칙 확인 후 반영
  function userSet(name, value) {
    var why = name === "gear_position" ? gearBlocked(value) : name === "ignition_on" ? ignitionBlocked(value) : null;
    if (why) { notifyDrive(why); return; }
    setValue(name, value);
  }

  // 사용자가 고른 속도: 범위 안이면 목표 속도, 범위 밖이면 센서 고장 주입
  function setSpeedCommand(v) {
    if (isOob("vehicle_speed_kph", v)) {
      drive.fault = v;
      log("in", "속도 센서 고장 주입: 송신값 " + v + " km/h (실제 속도 " + fmtNum(drive.speed) + " km/h)");
      sendSpeed(v);
      return;
    }
    if (drive.fault !== null) log("in", "속도 센서 고장 주입 해제");
    drive.fault = null;
    if (drive.target !== v) log("in", "목표 속도 = " + v + " km/h");
    drive.target = v;
    sendSpeed(drive.speed);
  }

  // 속도 신호 값만 바꾼다 (기록은 호출한 쪽에서)
  function sendSpeed(v) {
    inputs.vehicle_speed_kph = v;
    renderControls();
    renderScene();
  }

  // TC 사전조건: 규칙을 거치지 않고 실제 속도·목표 속도를 바로 맞춘다
  function setDirect(name, value) {
    if (name === "vehicle_speed_kph") {
      if (isOob(name, value)) {
        drive.fault = value;
      } else {
        drive.fault = null;
        drive.speed = drive.target = value;
      }
    }
    setValue(name, value);
    renderControls();
    renderScene();
  }

  var lastDriveTick = performance.now();
  setInterval(function () {
    var now = performance.now();
    var dt = Math.min(0.5, (now - lastDriveTick) / 1000);
    lastDriveTick = now;

    var g = inputs.gear_position;
    var v = drive.speed;
    var t = g === "R" ? Math.min(drive.target, DRIVE.REVERSE_MAX) : drive.target;
    var powered = inputs.ignition_on && (g === "D" || g === "R");
    if (g === "P") v = 0;
    else if (powered && t > v) v = Math.min(t, v + DRIVE.ACCEL * dt);
    else if (t < v) v = Math.max(t, v - DRIVE.BRAKE * dt);
    else if (!powered) v = Math.max(0, v - DRIVE.COAST * dt);
    v = Math.round(v * 100) / 100;
    if (v === drive.speed) return;

    var prev = drive.speed;
    drive.speed = v;
    if (v === 0) log("in", "차량 정지 (속도 0 km/h)");
    else if (v === t && prev !== t) log("in", "속도 " + v + " km/h 도달");
    if (drive.fault === null) sendSpeed(v);
    else { renderControls(); renderScene(); }
  }, DRIVE.TICK_MS);

  function driveStatus() {
    var g = inputs.gear_position, v = drive.speed;
    var t = g === "R" ? Math.min(drive.target, DRIVE.REVERSE_MAX) : drive.target;
    var head = "실제 " + fmtNum(v) + " km/h" + (g === "R" && v > 0 ? " (후진)" : "") + " · 목표 " + fmtNum(drive.target) + " km/h";
    var state;
    if (g === "P") state = "P: 정지";
    else if (inputs.ignition_on && (g === "D" || g === "R")) {
      state = v < t ? "가속 중" : v > t ? "감속 중" : v > 0 ? "속도 유지" : "정지";
      if (g === "R" && drive.target > DRIVE.REVERSE_MAX) state += " (후진 최대 " + DRIVE.REVERSE_MAX + " km/h)";
    } else {
      var why = inputs.ignition_on ? "N" : "시동 꺼짐";
      state = why + ": " + (v === 0 ? "정지" : t < v ? "브레이크 감속 중" : "관성 감속 중");
    }
    return head + " · " + state;
  }

  // ================================================================ 입력 변경
  function setPeriodic(name, value) {
    if (inputs[name] === value) return;
    inputs[name] = value;
    log("in", LABEL[name] + " = " + fmtValue(name, value) + (txEnabled[name] ? " (다음 주기 송신부터)" : " (송신 중단 상태)"));
    renderControls();
    renderScene();
  }

  function setEvent(name, value) {
    if (inputs[name] === value) return;
    inputs[name] = value;
    var s = {};
    s[name] = value;
    sendInput(s, "이벤트");
    renderControls();
    renderScene();
  }

  function setValue(name, value) {
    if (PERIODIC.indexOf(name) >= 0) setPeriodic(name, value);
    else setEvent(name, value);
  }

  function setTx(name, on) {
    if (txEnabled[name] === on) return;
    txEnabled[name] = on;
    var row = log("in", LABEL[name] + " 송신 " + (on ? "재개" : "중단"));
    // 수신 시간으로 판정하는 TC에서만 '송신 중단' 행 옆에 마지막 수신 시각을 덧붙인다
    if (on) delete stopWatch[name];
    else if (lastTime !== null && currentTc && window.VBC_RX_LOG_TCS.indexOf(currentTc.id) >= 0) {
      stopWatch[name] = { t: lastTime, row: row };
    }
    renderControls();
  }

  function setAllTx(on) {
    PERIODIC.forEach(function (s) { setTx(s, on); });
  }

  function fmtValue(name, v) {
    if (typeof v === "boolean") {
      if (name === "ignition_on") return v ? "켜짐" : "꺼짐";
      return v ? "열림" : "닫힘";
    }
    return String(v);
  }

  function isOob(name, v) {
    var r = VALID_RANGE[name];
    return r ? (v < r[0] || v > r[1]) : false;
  }

  // ================================================================ 컨트롤 생성
  function buildRangeControls() {
    Array.prototype.forEach.call(document.querySelectorAll(".range-ctl"), function (box) {
      var name = box.dataset.signal;
      var min = +box.dataset.min, max = +box.dataset.max;
      var smin = +box.dataset.smin, smax = +box.dataset.smax;
      var isDrive = !!box.dataset.drive;
      var setter = isDrive ? setSpeedCommand : function (v) { setPeriodic(name, v); };

      var row = document.createElement("div");
      row.className = "range-row";
      var range = document.createElement("input");
      range.type = "range";
      range.min = smin; range.max = smax; range.step = 1;
      range.setAttribute("aria-label", LABEL[name]);
      var num = document.createElement("input");
      num.type = "number";
      num.step = "any";
      num.setAttribute("aria-label", LABEL[name] + " 값 직접 입력 (범위 제한 없음" + (isDrive ? ", 범위 밖은 센서 고장 주입)" : ")"));
      row.appendChild(range);
      row.appendChild(num);

      var track = document.createElement("div");
      track.className = "range-track";
      var valid = document.createElement("div");
      valid.className = "valid";
      valid.style.left = ((min - smin) / (smax - smin) * 100) + "%";
      valid.style.width = ((max - min) / (smax - smin) * 100) + "%";
      track.appendChild(valid);
      var legend = document.createElement("div");
      legend.className = "range-legend";
      legend.innerHTML = "<span>" + smin + "</span><span>유효 " + min + " ~ " + max + " " + box.dataset.unit +
        (isDrive ? " (빨간 버튼 = 센서 고장 주입)" : " (빗금 = 범위 밖)") + "</span><span>" + smax + "</span>";

      var note = document.createElement("div");
      note.className = "oob-note";

      var chips = document.createElement("div");
      chips.className = "chips";
      box.dataset.presets.split(",").forEach(function (t) {
        var v = +t;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = t;
        if (v < min || v > max) {
          b.className = "out";
          if (isDrive) b.title = "속도 센서 고장 주입: 이 값을 그대로 송신합니다";
        }
        b.addEventListener("click", function () { setter(v); });
        chips.appendChild(b);
      });

      box.appendChild(row);
      box.appendChild(track);
      box.appendChild(legend);
      box.appendChild(chips);
      if (isDrive) {
        box._status = document.createElement("div");
        box._status.className = "drive-status";
        box.appendChild(box._status);
      }
      box.appendChild(note);

      range.addEventListener("input", function () { setter(+range.value); });
      num.addEventListener("change", function () {
        var v = parseFloat(num.value);
        if (isFinite(v)) setter(v);
        else num.value = inputs[name];
      });
      box._range = range;
      box._num = num;
      box._note = note;
    });
  }

  function bindSeg(id, name, parse, set) {
    set = set || setValue;
    Array.prototype.forEach.call($(id).querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { set(name, parse(b.dataset.value)); });
    });
  }

  function bindControls() {
    buildRangeControls();
    bindSeg("ctl-ignition", "ignition_on", function (v) { return v === "true"; }, userSet);
    bindSeg("ctl-gear", "gear_position", String, userSet);
    bindSeg("ctl-light", "light_switch", String);
    bindSeg("ctl-wiper", "wiper_switch", String);

    Array.prototype.forEach.call(document.querySelectorAll("[data-door]"), function (el) {
      el.addEventListener("click", function () {
        var k = el.dataset.door;
        var why = doorBlocked(k);
        if (why) { notifyDrive(why); return; }
        setEvent(k, !inputs[k]);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tx-btn"), function (b) {
      b.addEventListener("click", function () { setTx(b.dataset.tx, !txEnabled[b.dataset.tx]); });
    });
    $("btn-stop-all").addEventListener("click", function () { setAllTx(false); });
    $("btn-resume-all").addEventListener("click", function () { setAllTx(true); });

    $("btn-reset").addEventListener("click", function () {
      var stopped = $("opt-start-stopped").checked;
      requestReset(stopped ? "주기 신호 모두 중단 상태로 시작" : "버튼").then(function () {
        setAllTx(!stopped);
        sendEventsOnce("새로 시작"); // B9
      }).catch(function (e) { log("sys", "새로 시작 실패: " + e.message); });
    });

    $("btn-marker").addEventListener("click", setMarker);
    $("btn-csv").addEventListener("click", downloadCsv);
    $("btn-clear").addEventListener("click", function () { logRows = []; $("log-body").innerHTML = ""; });
  }

  function setMarker() {
    if (lastTime === null) return;
    setMarkerAt(lastTime, "");
  }

  function setMarkerAt(t, why) {
    markerTime = t;
    log("mark", "t=0 기준 시각 표시 (time_ms " + markerTime + ")" + (why ? " - " + why : ""));
    renderMarker();
  }

  // ================================================================ 화면 갱신
  function setConn(on) {
    var el = $("conn");
    el.textContent = on ? "연결됨" : "연결 안 됨";
    el.className = "pill " + (on ? "pill-on" : "pill-off");
  }

  function markSeg(id, value) {
    Array.prototype.forEach.call($(id).querySelectorAll("button"), function (b) {
      b.classList.toggle("active", b.dataset.value === String(value));
    });
  }

  function renderControls() {
    markSeg("ctl-ignition", inputs.ignition_on);
    markSeg("ctl-gear", inputs.gear_position);
    markSeg("ctl-light", inputs.light_switch);
    markSeg("ctl-wiper", inputs.wiper_switch);
    Array.prototype.forEach.call($("ctl-gear").querySelectorAll("button"), function (b) {
      var why = gearBlocked(b.dataset.value);
      b.classList.toggle("blocked", !!why);
      b.title = why || "";
    });
    Array.prototype.forEach.call($("ctl-ignition").querySelectorAll("button"), function (b) {
      var why = ignitionBlocked(b.dataset.value === "true");
      b.classList.toggle("blocked", !!why);
      b.title = why || "";
    });

    Array.prototype.forEach.call(document.querySelectorAll(".range-ctl"), function (box) {
      var name = box.dataset.signal;
      var v = inputs[name];
      // 속도: 슬라이더 = 목표 속도, 숫자 칸 = 목표 속도 또는 고장 주입값
      var rv = box._status ? drive.target : v;
      var nv = box._status && drive.fault !== null ? drive.fault : rv;
      if (box._range && +box._range.value !== rv) box._range.value = rv;
      if (box._num && document.activeElement !== box._num) box._num.value = nv;
      var oob = isOob(name, v);
      box.classList.toggle("oob", oob);
      if (box._status) {
        box._status.textContent = driveStatus();
        box._note.textContent = drive.fault !== null ? "속도 센서 고장 주입 중: " + drive.fault +
          " km/h를 그대로 송신합니다 (범위 안 속도를 고르면 해제)" : "";
      } else {
        box._note.textContent = oob ? "유효 범위 밖 값입니다. 그대로 송신합니다 (C2 시험)" : "";
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll(".tx-btn"), function (b) {
      var on = txEnabled[b.dataset.tx];
      b.classList.toggle("stopped", !on);
      b.closest(".ctl").classList.toggle("stopped", !on);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".door-btn"), function (b) {
      var why = doorBlocked(b.dataset.door);
      b.classList.toggle("open", inputs[b.dataset.door]);
      b.classList.toggle("blocked", !!why);
      b.title = why || "";
    });
  }

  function onOutput(msg) {
    var prev = lastOut;
    lastOut = msg;
    lastTime = msg.time_ms;
    $("time-ms").textContent = msg.time_ms;
    logOutputChange(prev, msg);
    renderOutputs();
    renderMarker();
    if (!prev || prev.door_locked !== msg.door_locked) renderControls(); // 도어 열기 막힘 표시
    if (!msg.rx && !noRxWarned) {
      noRxWarned = true;
      log("sys", "서버가 수신 시각(rx)을 보내지 않습니다 - 이전 버전 server.py입니다. 서버를 다시 시작하세요");
    }
    logLastRx(msg);
    outputWaiters.slice().forEach(function (w) { w(msg); });
  }

  // 출력 메시지가 cond를 만족할 때까지 기다린다. limitMs(벽시계) 안에 안 오면 실패
  function waitOutput(cond, limitMs, what) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { done(); reject(new Error(what + " 대기 시간 초과")); }, limitMs);
      function done() { clearTimeout(timer); outputWaiters = outputWaiters.filter(function (x) { return x !== w; }); }
      function w(msg) { if (cond(msg)) { done(); resolve(msg); } }
      outputWaiters.push(w);
    });
  }

  // '송신 중단' 행 옆에 그 신호의 마지막 수신 시각을 덧붙인다 (C2·C4 미수신 0.5초의 0초, 서버 rx 필드)
  // 중단을 누르기 전에 이미 보낸 값은 다음 Step에서 수신되므로, 누른 뒤 150 ms가 지난 출력에서 확정한다
  function logLastRx(o) {
    Object.keys(stopWatch).forEach(function (k) {
      var w = stopWatch[k];
      if (o.time_ms < w.t + 150) return;
      delete stopWatch[k];
      if (!o.rx) return;
      var r = o.rx[k];
      appendLog(w.row, r.received ?
        " · 마지막 수신 time_ms " + r.last_rx_ms + " (미수신 0.5초 판정 시각 " + (r.last_rx_ms + RX_TIMEOUT_MS) + ")" :
        " · 수신한 적 없음, 시작 time_ms " + r.last_rx_ms + "부터 셈 (0.5초 판정 시각 " + (r.last_rx_ms + RX_TIMEOUT_MS) + ")");
    });
  }

  function renderMarker() {
    $("marker-elapsed").textContent = (markerTime === null || lastTime === null) ? "-" :
      ((lastTime - markerTime) / 1000).toFixed(2) + " s";
  }

  function setInd(id, value, cls) {
    var el = $(id);
    el.querySelector(".v").textContent = value;
    el.classList.remove("on", "amber", "red");
    if (cls) el.classList.add(cls);
  }

  function renderOutputs() {
    var o = lastOut;
    if (!o) return;
    setInd("ind-headlamp", o.headlamp_on ? "켜짐" : "꺼짐", o.headlamp_on ? "on" : "");
    setInd("ind-wiper", WIPER_TEXT[o.wiper_level] || o.wiper_level, o.wiper_level !== "STOP" ? "on" : "");
    setInd("ind-lock", o.door_locked ? "잠김" : "풀림", o.door_locked ? "on" : "");
    setInd("ind-lux-fault", o.ambient_light_sensor_fault ? "고장" : "정상", o.ambient_light_sensor_fault ? "red" : "");
    setInd("ind-rain-fault", o.rain_sensor_fault ? "고장" : "정상", o.rain_sensor_fault ? "red" : "");
    setInd("ind-timeout", o.vehicle_state_timeout ? "수신 중단" : "정상", o.vehicle_state_timeout ? "red" : "");

    var tag = $("cl-speed-valid");
    tag.textContent = o.vehicle_speed_valid ? "유효한 속도: 유효 (" + inputs.vehicle_speed_kph + " km/h)" : "유효한 속도: 무효";
    tag.className = "tag " + (o.vehicle_speed_valid ? "ok" : "bad");

    var w = $("cl-warning");
    w.className = "warning " + (o.cluster_warning === "NONE" ? "warn-none" :
      o.cluster_warning === "DOOR_OPEN" ? "warn-door" : "warn-sensor");
    $("cl-warning-text").textContent = WARNING_TEXT[o.cluster_warning] || o.cluster_warning;

    $("lamp-l").classList.toggle("on", o.headlamp_on);
    $("lamp-r").classList.toggle("on", o.headlamp_on);
    $("beams").setAttribute("opacity", o.headlamp_on ? "1" : "0");
    $("lock").classList.toggle("locked", o.door_locked);
    $("lock-shackle").setAttribute("d", o.door_locked ? "M-7,-2 v-6 a7,7 0 0 1 14,0 v6" : "M-7,-2 v-6 a7,7 0 0 1 14,0 v-3");
    wiperLevel = o.wiper_level;
  }

  // 장면: 입력값(환경)과 출력값(차량 상태)을 그림으로 보여 준다
  function renderScene() {
    var lux = inputs.ambient_light_lux, rain = inputs.rain_level_pct, spd = inputs.vehicle_speed_kph;

    // 조도: 0 lux 이하 = 가장 어둡게, 10000 lux 이상 = 밝게 (로그 눈금, 표시용)
    var t = lux <= 1 ? 0 : Math.min(1, Math.log10(lux) / 4);
    $("env-dark").setAttribute("opacity", (0.78 * (1 - t)).toFixed(3));

    setEnvText("env-lux", fmtNum(lux) + " lux", isOob("ambient_light_lux", lux), !txEnabled.ambient_light_lux);
    setEnvText("env-rain", fmtNum(rain) + " %", isOob("rain_level_pct", rain), !txEnabled.rain_level_pct);
    setEnvText("env-speed", fmtNum(spd) + " km/h", isOob("vehicle_speed_kph", spd), !txEnabled.vehicle_speed_kph);
    setEnvText("env-gear", inputs.gear_position, false, !txEnabled.gear_position);

    var anyOob = isOob("ambient_light_lux", lux) || isOob("rain_level_pct", rain) || isOob("vehicle_speed_kph", spd);
    $("oob-overlay").setAttribute("opacity", anyOob ? "1" : "0");

    setRainDrops(Math.round(Math.max(0, Math.min(100, rain)) * 0.9));

    Array.prototype.forEach.call(document.querySelectorAll("#car .door"), function (g) {
      var k = g.dataset.door;
      var open = inputs[k];
      g.classList.toggle("open", open);
      var r = g.querySelector("rect");
      var x = +r.getAttribute("x"), y = +r.getAttribute("y"), w = +r.getAttribute("width");
      var left = k === "door_fl_open" || k === "door_rl_open";
      var hx = left ? x : x + w;
      g.setAttribute("transform", open ? "rotate(" + (left ? 55 : -55) + " " + hx + " " + y + ")" : "");
    });

    $("cl-speed").textContent = fmtNum(spd);
    $("cl-gear").textContent = inputs.gear_position;
    $("cl-ign").textContent = inputs.ignition_on ? "켜짐" : "꺼짐";
    if (lastOut) renderOutputs();
  }

  function setEnvText(id, text, oob, stopped) {
    var el = $(id);
    el.textContent = text + (stopped ? " (송신 중단)" : oob ? " (범위 밖)" : "");
    el.setAttribute("class", oob || stopped ? "oob" : "");
  }

  function fmtNum(v) {
    return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("ko-KR") : String(Math.round(v * 10) / 10);
  }

  // ================================================================ 애니메이션 (차선, 비, 와이퍼)
  var SVGNS = "http://www.w3.org/2000/svg";
  var laneMarks = [];
  var drops = [];
  var laneOffset = 0;
  var wiperLevel = "STOP";
  var wiperPhaseStart = 0;
  var lastWiperLevel = "STOP";

  function initLane() {
    var g = $("lane");
    for (var i = 0; i < 8; i++) {
      var r = document.createElementNS(SVGNS, "rect");
      r.setAttribute("class", "lane-mark");
      r.setAttribute("x", 316); r.setAttribute("width", 8); r.setAttribute("height", 34);
      g.appendChild(r);
      laneMarks.push(r);
    }
  }

  function setRainDrops(n) {
    var g = $("rain");
    while (drops.length < n) {
      var l = document.createElementNS(SVGNS, "line");
      l.setAttribute("class", "raindrop");
      var d = { el: l, x: Math.random() * 640, y: Math.random() * 440, v: 380 + Math.random() * 220 };
      g.appendChild(l);
      drops.push(d);
    }
    while (drops.length > n) g.removeChild(drops.pop().el);
  }

  // 와이퍼 한 번 왕복: LOW 1.4초, HIGH 0.7초, INT 1.4초 왕복 후 2초 쉼 (표시용)
  var WIPER_ANIM = { LOW: [1400, 0], HIGH: [700, 0], INT: [1400, 2000] };

  function wiperAngle(now) {
    if (wiperLevel !== lastWiperLevel) {
      lastWiperLevel = wiperLevel;
      wiperPhaseStart = now;
    }
    var a = WIPER_ANIM[wiperLevel];
    if (!a) return 0;
    var cycle = a[0] + a[1];
    var t = (now - wiperPhaseStart) % cycle;
    if (t > a[0]) return 0;
    return 100 * Math.sin(Math.PI * t / a[0]);
  }

  var prevFrame = performance.now();
  function frame(now) {
    var dt = Math.min(0.1, (now - prevFrame) / 1000);
    prevFrame = now;

    var v = drive.speed * (inputs.gear_position === "R" ? -1 : 1);
    laneOffset = ((laneOffset + v * 4 * dt) % 80 + 80) % 80;
    laneMarks.forEach(function (r, i) { r.setAttribute("y", (i * 80 - 80 + laneOffset).toFixed(1)); });

    drops.forEach(function (d) {
      d.y += d.v * dt;
      if (d.y > 450) { d.y = -20; d.x = Math.random() * 640; }
      d.el.setAttribute("x1", d.x.toFixed(1)); d.el.setAttribute("y1", d.y.toFixed(1));
      d.el.setAttribute("x2", (d.x - 3).toFixed(1)); d.el.setAttribute("y2", (d.y + 14).toFixed(1));
    });

    var ang = wiperAngle(now);
    $("wiper-l").setAttribute("transform", "rotate(" + (-ang).toFixed(1) + " -34 -40)");
    $("wiper-r").setAttribute("transform", "rotate(" + (-ang).toFixed(1) + " 18 -40)");
    requestAnimationFrame(frame);
  }

  // ================================================================ 기록 (증거)
  var logRows = [];
  var LOG_MAX = 20000;
  var KIND_TEXT = { out: "출력", "in": "입력", sys: "시스템", mark: "기준", valid: "유효 속도", pass: "판정", fail: "판정" };

  function log(kind, text) {
    var row = { time: lastTime, rel: (markerTime === null || lastTime === null) ? null : lastTime - markerTime, kind: kind, text: text };
    logRows.push(row);
    if (logRows.length > LOG_MAX) logRows.shift();
    var body = $("log-body");
    var wrap = body.closest(".log-wrap");
    var atBottom = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 4;
    var tr = document.createElement("tr");
    tr.className = "k-" + kind;
    [row.time === null ? "-" : row.time, row.rel === null ? "" : (row.rel / 1000).toFixed(2) + " s", KIND_TEXT[kind], text]
      .forEach(function (c) { var td = document.createElement("td"); td.textContent = c; tr.appendChild(td); });
    body.appendChild(tr);
    while (body.childNodes.length > 2000) body.removeChild(body.firstChild);
    if (atBottom) wrap.scrollTop = wrap.scrollHeight;
    row.td = tr.lastChild;
    return row;
  }

  // 이미 남긴 행의 내용 뒤에 덧붙인다 (화면과 CSV 모두)
  function appendLog(row, more) {
    row.text += more;
    row.td.textContent = row.text;
  }

  var OUT_FIELDS = ["headlamp_on", "wiper_level", "door_locked", "cluster_warning", "ambient_light_sensor_fault",
    "rain_sensor_fault", "vehicle_speed_valid", "vehicle_state_timeout"];

  function logOutputChange(prev, cur) {
    if (!prev) {
      log("out", OUT_FIELDS.map(function (f) { return f + "=" + cur[f]; }).join(", "));
      return;
    }
    var diff = OUT_FIELDS.filter(function (f) { return prev[f] !== cur[f]; })
      .map(function (f) { return f + ": " + prev[f] + " → " + cur[f]; });
    if (diff.length) log("out", diff.join(", "));
    if (prev.vehicle_speed_valid !== cur.vehicle_speed_valid) logSpeedValid(cur);
  }

  // 유효한 속도 변경 시점과 이유 (C3: 속도·기어·시동 1회 이상 수신 + 수신 중단 아님 + 속도 센서 고장 아님)
  var STATE_SIGS = ["vehicle_speed_kph", "gear_position", "ignition_on"];
  function logSpeedValid(o) {
    var why = [];
    if (o.rx) {
      STATE_SIGS.forEach(function (k) {
        var r = o.rx[k];
        var age = o.time_ms - r.last_rx_ms;
        if (!r.received) why.push(LABEL[k] + " 수신한 적 없음");
        else if (age >= RX_TIMEOUT_MS) why.push(LABEL[k] + " 미수신 " + age + " ms (마지막 수신 " + r.last_rx_ms + ")");
      });
      var sp = o.rx.vehicle_speed_kph;
      if (sp.received && isOob("vehicle_speed_kph", sp.value)) why.push("속도 " + sp.value + " km/h 범위 밖 (속도 센서 고장)");
    }
    var text = "유효한 속도: " + (o.vehicle_speed_valid ? "무효 → 유효" : "유효 → 무효");
    if (o.vehicle_speed_valid) {
      if (o.rx) text += " (속도 " + fmtValue("vehicle_speed_kph", o.rx.vehicle_speed_kph.value) + " km/h)";
    } else if (why.length) {
      text += " (이유: " + why.join(", ") + ")";
    }
    log("valid", text);
  }

  function downloadCsv() {
    var esc = function (s) { s = String(s === null ? "" : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var lines = ["time_ms,t0_rel_ms,kind,detail"];
    logRows.forEach(function (r) { lines.push([r.time, r.rel, KIND_TEXT[r.kind], r.text].map(esc).join(",")); });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    var stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = URL.createObjectURL(blob);
    a.download = "vbc_log_" + (currentTc ? currentTc.id + "_" : "") + stamp + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ================================================================ 테스트케이스
  var cases = [];
  var currentTc = null;

  function loadCases() {
    fetch("testcases.json").then(function (r) { return r.json(); }).then(function (d) {
      cases = d.cases || [];
      $("tc-source").textContent = d.source + " · " + cases.length + "개";
      renderTcList();
    }).catch(function () {
      $("tc-list").textContent = "testcases.json을 불러오지 못했습니다.";
    });
    $("tc-search").addEventListener("input", renderTcList);
  }

  function renderTcList() {
    var q = $("tc-search").value.trim().toLowerCase();
    var nav = $("tc-list");
    nav.innerHTML = "";
    var group = null;
    cases.forEach(function (c) {
      if (q && (c.id + " " + c.purpose + " " + c.req).toLowerCase().indexOf(q) < 0) return;
      if (c.sheet !== group) {
        group = c.sheet;
        var h = document.createElement("div");
        h.className = "tc-group";
        h.textContent = group;
        nav.appendChild(h);
      }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tc-item" + (currentTc && currentTc.id === c.id ? " active" : "");
      b.innerHTML = "<b></b><small></small>";
      b.firstChild.textContent = c.id.replace("TC-", "");
      b.lastChild.textContent = c.purpose;
      b.title = c.purpose;
      b.addEventListener("click", function () { selectTc(c); });
      nav.appendChild(b);
    });
  }

  function selectTc(c) {
    if (presetRunning) return;
    currentTc = c;
    renderTcList();
    var p = window.VBC_PRESETS[c.id];
    var el = $("tc-detail");
    el.innerHTML = "";

    var title = document.createElement("div");
    title.className = "tc-title";
    title.innerHTML = "<h3></h3><span class='chip'></span><span class='chip'></span>";
    title.childNodes[0].textContent = c.id;
    title.childNodes[1].textContent = c.req;
    title.childNodes[2].textContent = c.technique;
    el.appendChild(title);

    var dl = document.createElement("dl");
    dl.className = "tc-grid";
    [["테스트 목적", c.purpose], ["사전조건", c.precondition], ["입력", c.input], ["테스트 절차", c.procedure],
      ["예상 결과", c.expected, "expected"], ["비고", c.note]].forEach(function (f) {
      if (!f[1]) return;
      var dt = document.createElement("dt"); dt.textContent = f[0];
      var dd = document.createElement("dd"); dd.textContent = f[1];
      if (f[2]) dd.className = f[2];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    el.appendChild(dl);

    var run = document.createElement("div");
    run.className = "tc-run";
    var btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = "사전조건 적용";
    var mark = document.createElement("button");
    mark.className = "btn";
    mark.textContent = "t=0 표시";
    mark.title = "절차의 t=0 시점에 누르면 기록에 기준 시각이 남습니다";
    mark.addEventListener("click", setMarker);
    var msg = document.createElement("span");
    msg.className = "msg";
    msg.textContent = p ? "새로 시작 후 사전조건 입력을 세팅합니다" + (p.note ? " · " + p.note : "") :
      "이 TC는 프리셋이 없습니다. 사전조건을 직접 세팅하세요.";
    if (!p) btn.disabled = true;
    var auto = AUTO_TESTS[c.id];
    var go = null;
    if (auto) {
      go = document.createElement("button");
      go.className = "btn btn-primary";
      go.textContent = "테스트 수행";
      go.title = "사전조건 적용 후 테스트 절차를 자동으로 진행하고 판정을 기록에 남깁니다";
      go.disabled = true;
      go.addEventListener("click", function () { runAuto(c, auto, btn, go, msg); });
    }
    btn.addEventListener("click", function () { runPreset(c, p, btn, msg, go); });
    run.appendChild(btn);
    if (go) run.appendChild(go);
    run.appendChild(mark);
    run.appendChild(msg);
    el.appendChild(run);
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function runPreset(c, p, btn, msg, go) {
    if (presetRunning) return;
    presetRunning = true;
    btn.disabled = true;
    if (go) go.disabled = true;
    msg.className = "msg";
    msg.textContent = "새로 시작 중…";
    log("sys", c.id + " 사전조건 적용 시작");

    requestReset(c.id + " 사전조건").then(function () {
      setAllTx(!p.stopAll);
      sendEventsOnce("새로 시작"); // B9
      var chain = Promise.resolve();
      p.steps.forEach(function (st) {
        chain = chain.then(function () {
          if (st.set) {
            Object.keys(st.set).forEach(function (k) { setDirect(k, st.set[k]); });
          } else if (st.stop) {
            st.stop.forEach(function (k) { setTx(k, false); });
          } else if (st.wait) {
            msg.textContent = "사전조건 유지 중… " + (st.wait / 1000).toFixed(1) + "초";
            return sleep(st.wait);
          }
        });
      });
      return chain;
    }).then(function () {
      msg.className = "msg done";
      msg.textContent = go ? "사전조건 적용 완료 - '테스트 수행'을 누르세요" :
        "사전조건 적용 완료 - '테스트 절차'를 진행하세요 (절차의 t=0에 't=0 표시')";
      log("sys", c.id + " 사전조건 적용 완료");
      if (go) go.disabled = false;
    }).catch(function (e) {
      msg.textContent = "실패: " + e.message;
      log("sys", c.id + " 사전조건 적용 실패: " + e.message);
    }).then(function () {
      presetRunning = false;
      btn.disabled = false;
    });
  }

  // ================================================================ 자동 시험
  // 사전조건 적용 뒤 '테스트 수행'을 누르면 05 문서의 테스트 절차를 그대로 진행하고 예상 결과와 비교해 기록한다.
  // 시각은 모두 VehicleController의 time_ms(출력 메시지)로 잰다. 판정에 서버 rx 필드(수신 Step 시각)를 쓴다.
  var AUTO_TESTS = {};

  // TC-C1-01: 와이퍼 LOW 10초 (조명 스위치 OFF) → AUTO 입력 직후 전조등 켜짐 (C1, L6)
  AUTO_TESTS["TC-C1-01"] = function (t) {
    var t0;
    var earlyOn = null; // 0~9.9초 사이 전조등이 켜진 시각
    t.say("1) t=0초 와이퍼 스위치 LOW 입력 (조명 스위치 OFF 유지)");
    setValue("wiper_switch", "LOW");
    return waitOutput(function (o) { return o.wiper_level !== "STOP"; }, 2000, "와이퍼 작동").then(function (o) {
      t0 = o.time_ms;
      setMarkerAt(t0, "와이퍼 작동 시작 (L6 작동 시간 측정 시작)");
      t.say("2) 9.9초 시점 전조등 확인까지 대기");
      return waitOutput(function (o) {
        if (o.headlamp_on && earlyOn === null) earlyOn = o.time_ms;
        return o.time_ms >= t0 + 9900;
      }, 15000, "9.9초 시점");
    }).then(function (o) {
      t.check("9.9초: 전조등 꺼짐(L4)", !o.headlamp_on && earlyOn === null,
        "time_ms " + o.time_ms + " (t=" + t.rel(o.time_ms) + ") 전조등 " + (o.headlamp_on ? "켜짐" : "꺼짐") +
        (earlyOn !== null ? ", time_ms " + earlyOn + "에 먼저 켜짐" : ""));
      // 9.95초 출력을 받은 직후 보내면 다음 Step(10.0초)에서 수신된다
      return waitOutput(function (o) { return o.time_ms >= t0 + 9950; }, 2000, "9.95초 시점");
    }).then(function () {
      t.say("3) t=10.0초 조명 스위치 AUTO 입력");
      setValue("light_switch", "AUTO");
      return waitOutput(function (o) {
        var r = o.rx && o.rx.light_switch;
        return r && r.value === "AUTO" && r.last_rx_ms > t0;
      }, 2000, "AUTO 수신");
    }).then(function (o) {
      var rxAt = o.rx.light_switch.last_rx_ms;
      t.say("조명 스위치 AUTO 수신: time_ms " + rxAt + " (t=" + t.rel(rxAt) + ")");
      if (o.headlamp_on) return { o: o, rxAt: rxAt };
      return waitOutput(function (x) { return x.headlamp_on || x.time_ms > rxAt + 50; }, 2000, "전조등 확인")
        .then(function (x) { return { o: x, rxAt: rxAt }; });
    }).then(function (r) {
      t.say("4) 전조등 확인");
      t.check("AUTO 입력 직후(+50 ms 이내): 전조등 켜짐(L6)", r.o.headlamp_on && r.o.time_ms - r.rxAt <= 50,
        "AUTO 수신 time_ms " + r.rxAt + " → time_ms " + r.o.time_ms + " (+" + (r.o.time_ms - r.rxAt) + " ms) 전조등 " +
        (r.o.headlamp_on ? "켜짐" : "꺼짐") + ", 와이퍼 작동 " + ((r.o.time_ms - t0) / 1000).toFixed(2) + "초");
    });
  };

  function runAuto(c, fn, btn, go, msg) {
    if (presetRunning) return;
    presetRunning = true;
    btn.disabled = true;
    go.disabled = true;
    msg.className = "msg";
    msg.textContent = "테스트 수행 중…";
    var results = [];
    var t = {
      say: function (text) { msg.textContent = text; log("sys", c.id + " " + text); },
      check: function (name, ok, detail) {
        results.push(ok);
        log(ok ? "pass" : "fail", (ok ? "PASS" : "FAIL") + " " + c.id + " " + name + " - " + detail);
      },
      rel: function (ms) { return ((ms - markerTime) / 1000).toFixed(2) + " s"; }
    };
    log("sys", c.id + " 테스트 수행 시작");
    Promise.resolve().then(function () { return fn(t); }).then(function () {
      var pass = results.length > 0 && results.every(Boolean);
      log(pass ? "pass" : "fail", c.id + " 최종 판정: " + (pass ? "PASS" : "FAIL") + " (" + results.filter(Boolean).length + "/" +
        results.length + " 항목 통과)");
      msg.className = "msg " + (pass ? "done" : "fail");
      msg.textContent = "최종 판정: " + (pass ? "PASS" : "FAIL") + " - 자세한 내용은 기록 참고";
    }).catch(function (e) {
      log("fail", c.id + " 최종 판정: FAIL (중단: " + e.message + ")");
      msg.className = "msg fail";
      msg.textContent = "중단: " + e.message;
    }).then(function () {
      presetRunning = false;
      btn.disabled = false;
      // 다시 수행하려면 사전조건부터 다시 적용한다
    });
  }

  // ================================================================ 시작
  bindControls();
  initLane();
  renderControls();
  renderScene();
  loadCases();
  connect();
  requestAnimationFrame(frame);
})();
