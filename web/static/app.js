/*
 * app.js - VBC 웹 UI (feature/ui)
 * 근거: 04 SW 상세설계서 v1.1 '18_UI_연동', 03 인터페이스 정의서 v1.4 개요 B7~B10
 *
 * - 주기 신호 5개: 100 ms마다 한 메시지로 송신. 송신 중단한 신호는 메시지에서 뺀다 (B7, B8)
 * - 이벤트 신호 6개: 값이 바뀔 때 바뀐 신호만 송신. 시작·재연결 시 6개 현재값을 1회 송신 (B7, B9)
 * - 화면 초기값은 03 SIG-001~011 Initial Value와 같다
 * - 속도·조도·강우량은 유효 범위 밖 값도 그대로 보낸다 (C2 시험용, 18 시트)
 */
(function () {
  "use strict";

  var PERIODIC = ["vehicle_speed_kph", "gear_position", "ignition_on", "ambient_light_lux", "rain_level_pct"];
  var EVENTS = ["door_fl_open", "door_fr_open", "door_rl_open", "door_rr_open", "light_switch", "wiper_switch"];
  var TX_PERIOD_MS = 100;

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

  var $ = function (id) { return document.getElementById(id); };

  // ================================================================ 통신
  function connect() {
    var proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws");
    ws.onopen = function () {
      connected = true;
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
    log("in", LABEL[name] + " 송신 " + (on ? "재개" : "중단"));
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

      var row = document.createElement("div");
      row.className = "range-row";
      var range = document.createElement("input");
      range.type = "range";
      range.min = smin; range.max = smax; range.step = 1;
      range.setAttribute("aria-label", LABEL[name]);
      var num = document.createElement("input");
      num.type = "number";
      num.step = "any";
      num.setAttribute("aria-label", LABEL[name] + " 값 직접 입력 (범위 제한 없음)");
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
        " (빗금 = 범위 밖)</span><span>" + smax + "</span>";

      var note = document.createElement("div");
      note.className = "oob-note";

      var chips = document.createElement("div");
      chips.className = "chips";
      box.dataset.presets.split(",").forEach(function (t) {
        var v = +t;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = t;
        if (v < min || v > max) b.className = "out";
        b.addEventListener("click", function () { setPeriodic(name, v); });
        chips.appendChild(b);
      });

      box.appendChild(row);
      box.appendChild(track);
      box.appendChild(legend);
      box.appendChild(chips);
      box.appendChild(note);

      range.addEventListener("input", function () { setPeriodic(name, +range.value); });
      num.addEventListener("change", function () {
        var v = parseFloat(num.value);
        if (isFinite(v)) setPeriodic(name, v);
        else num.value = inputs[name];
      });
      box._range = range;
      box._num = num;
      box._note = note;
    });
  }

  function bindSeg(id, name, parse) {
    Array.prototype.forEach.call($(id).querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { setValue(name, parse(b.dataset.value)); });
    });
  }

  function bindControls() {
    buildRangeControls();
    bindSeg("ctl-ignition", "ignition_on", function (v) { return v === "true"; });
    bindSeg("ctl-gear", "gear_position", String);
    bindSeg("ctl-light", "light_switch", String);
    bindSeg("ctl-wiper", "wiper_switch", String);

    Array.prototype.forEach.call(document.querySelectorAll("[data-door]"), function (el) {
      el.addEventListener("click", function () {
        var k = el.dataset.door;
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
    markerTime = lastTime;
    log("mark", "t=0 기준 시각 표시 (time_ms " + markerTime + ")");
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

    Array.prototype.forEach.call(document.querySelectorAll(".range-ctl"), function (box) {
      var name = box.dataset.signal;
      var v = inputs[name];
      if (box._range && +box._range.value !== v) box._range.value = v;
      if (box._num && document.activeElement !== box._num) box._num.value = v;
      var oob = isOob(name, v);
      box.classList.toggle("oob", oob);
      box._note.textContent = oob ? "유효 범위 밖 값입니다. 그대로 송신합니다 (C2 시험)" : "";
    });

    Array.prototype.forEach.call(document.querySelectorAll(".tx-btn"), function (b) {
      var on = txEnabled[b.dataset.tx];
      b.classList.toggle("stopped", !on);
      b.closest(".ctl").classList.toggle("stopped", !on);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".door-btn"), function (b) {
      b.classList.toggle("open", inputs[b.dataset.door]);
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

    var spd = inputs.vehicle_speed_kph;
    var v = isFinite(spd) ? Math.max(0, Math.min(250, spd)) : 0;
    laneOffset = (laneOffset + v * 4 * dt) % 80;
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
  var KIND_TEXT = { out: "출력", "in": "입력", sys: "시스템", mark: "기준" };

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
    btn.addEventListener("click", function () { runPreset(c, p, btn, msg); });
    run.appendChild(btn);
    run.appendChild(mark);
    run.appendChild(msg);
    el.appendChild(run);
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function runPreset(c, p, btn, msg) {
    if (presetRunning) return;
    presetRunning = true;
    btn.disabled = true;
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
            Object.keys(st.set).forEach(function (k) { setValue(k, st.set[k]); });
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
      msg.textContent = "사전조건 적용 완료 - '테스트 절차'를 진행하세요 (절차의 t=0에 't=0 표시')";
      log("sys", c.id + " 사전조건 적용 완료");
    }).catch(function (e) {
      msg.textContent = "실패: " + e.message;
      log("sys", c.id + " 사전조건 적용 실패: " + e.message);
    }).then(function () {
      presetRunning = false;
      btn.disabled = false;
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
