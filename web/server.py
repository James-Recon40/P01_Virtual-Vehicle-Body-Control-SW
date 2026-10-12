#!/usr/bin/env python3
"""
server.py - 웹 UI ↔ VehicleController 브리지 (feature/ui)

근거: 04 SW 상세설계서 v1.1 '18_UI_연동', 03 인터페이스 정의서 v1.4 개요 B7~B10

- src/ 의 C 모듈을 공유 라이브러리로 빌드해 ctypes로 불러온다. 기능 로직은 C 코드만 쓴다.
- VehicleController_Step()을 50 ms마다 호출한다(now_ms = 0, 50, 100, ...).
- 브라우저와 WebSocket(/ws)으로 18 시트 JSON 메시지를 주고받는다.
- src/wiper, src/lighting 에 .c 가 아직 없으면 web/stubs/ 의 [임시] 스텁을 링크한다.

18 시트 규격 밖의 시험용 메시지 (UI 담당 결정):
  UI → 서버  {"type": "reset"}   VehicleController_Init()을 다시 호출하고 시각을 0으로 되돌린다
                                 (TC 사전조건 '프로그램 새로 시작' 시연용)
  서버 → UI  {"type": "hello", "stubs": [...], "step_ms": 50}   연결 직후 1회
  서버 → UI  {"type": "reset_done"}                              reset 처리 직후

외부 패키지 없이 Python 3.8+ 표준 라이브러리만 사용한다.
실행: python3 web/server.py [--port 8080] [--host 127.0.0.1]
"""
import argparse
import base64
import ctypes
import glob
import hashlib
import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

WEB_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(WEB_DIR)
SRC_DIR = os.path.join(ROOT_DIR, "src")
STATIC_DIR = os.path.join(WEB_DIR, "static")
BUILD_DIR = os.path.join(WEB_DIR, "build")
LIB_PATH = os.path.join(BUILD_DIR, "libvbc.so")

MODULE_DIRS = ["common", "vehicle_controller", "wiper", "lighting", "door_lock_cluster"]
STUBBABLE = {"wiper": "wiper_stub.c", "lighting": "lighting_stub.c"}

MAIN_CYCLE_MS = 50  # vbc_types.h MAIN_CYCLE_MS

# ---- vbc_types.h 입력 신호 비트 (03 SIG-001~011 순서) ----
INPUT_SIG_SPEED = 1 << 0
INPUT_SIG_GEAR = 1 << 1
INPUT_SIG_IGNITION = 1 << 2
INPUT_SIG_LIGHT = 1 << 3
INPUT_SIG_RAIN = 1 << 4
INPUT_SIG_DOOR_FL = 1 << 5
INPUT_SIG_DOOR_FR = 1 << 6
INPUT_SIG_DOOR_RL = 1 << 7
INPUT_SIG_DOOR_RR = 1 << 8
INPUT_SIG_LIGHT_SW = 1 << 9
INPUT_SIG_WIPER_SW = 1 << 10

# ---- enum 문자열 ↔ 값 (vbc_types.h 선언 순서, 18 시트 값) ----
GEAR = {"P": 0, "R": 1, "N": 2, "D": 3}
LIGHT_SW = {"AUTO": 0, "OFF": 1, "ON": 2}
WIPER_SW = {"OFF": 0, "AUTO": 1, "LOW": 2, "HIGH": 3}
WIPER_LEVEL = ["STOP", "INT", "LOW", "HIGH"]
CLUSTER_WARNING = ["NONE", "DOOR_OPEN", "AMBIENT_SENSOR", "RAIN_SENSOR"]


class VehicleInputs(ctypes.Structure):
    """VehicleInputs_t (vbc_types.h). enum은 gcc 기본 int 크기."""
    _fields_ = [
        ("vehicle_speed_kph", ctypes.c_float),
        ("gear_position", ctypes.c_int),
        ("ignition_on", ctypes.c_bool),
        ("ambient_light_lux", ctypes.c_float),
        ("rain_level_pct", ctypes.c_float),
        ("door_fl_open", ctypes.c_bool),
        ("door_fr_open", ctypes.c_bool),
        ("door_rl_open", ctypes.c_bool),
        ("door_rr_open", ctypes.c_bool),
        ("light_switch", ctypes.c_int),
        ("wiper_switch", ctypes.c_int),
    ]


class VehicleOutputs(ctypes.Structure):
    """VehicleOutputs_t (vbc_types.h)."""
    _fields_ = [
        ("vehicle_speed_valid", ctypes.c_bool),
        ("vehicle_state_timeout", ctypes.c_bool),
        ("ambient_light_sensor_fault", ctypes.c_bool),
        ("rain_sensor_fault", ctypes.c_bool),
        ("headlamp_on", ctypes.c_bool),
        ("wiper_level", ctypes.c_int),
        ("door_locked", ctypes.c_bool),
        ("cluster_warning", ctypes.c_int),
    ]


# 18 시트 입력 필드 → (구조체 필드, mask 비트, 변환 함수). 변환 결과 None이면 무시(수신으로 보지 않음)
def _num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return float(v)


def _bool(v):
    return v if isinstance(v, bool) else None


def _enum(table):
    return lambda v: table.get(v) if isinstance(v, str) else None


INPUT_FIELDS = {
    "vehicle_speed_kph": ("vehicle_speed_kph", INPUT_SIG_SPEED, _num),
    "gear_position": ("gear_position", INPUT_SIG_GEAR, _enum(GEAR)),
    "ignition_on": ("ignition_on", INPUT_SIG_IGNITION, _bool),
    "ambient_light_lux": ("ambient_light_lux", INPUT_SIG_LIGHT, _num),
    "rain_level_pct": ("rain_level_pct", INPUT_SIG_RAIN, _num),
    "door_fl_open": ("door_fl_open", INPUT_SIG_DOOR_FL, _bool),
    "door_fr_open": ("door_fr_open", INPUT_SIG_DOOR_FR, _bool),
    "door_rl_open": ("door_rl_open", INPUT_SIG_DOOR_RL, _bool),
    "door_rr_open": ("door_rr_open", INPUT_SIG_DOOR_RR, _bool),
    "light_switch": ("light_switch", INPUT_SIG_LIGHT_SW, _enum(LIGHT_SW)),
    "wiper_switch": ("wiper_switch", INPUT_SIG_WIPER_SW, _enum(WIPER_SW)),
}


# ---------------------------------------------------------------- build / load
def build_library():
    """src/*/*.c (+ 없는 모듈은 스텁) + bridge 를 libvbc.so 로 빌드한다."""
    sources, stubs = [], []
    for mod in MODULE_DIRS:
        found = sorted(glob.glob(os.path.join(SRC_DIR, mod, "*.c")))
        if found:
            sources += found
        elif mod in STUBBABLE:
            sources.append(os.path.join(WEB_DIR, "stubs", STUBBABLE[mod]))
            stubs.append(mod)
        else:
            sys.exit(f"[server] src/{mod}/ 에 .c 파일이 없어 실행할 수 없습니다.")
    sources.append(os.path.join(WEB_DIR, "bridge", "vbc_bridge.c"))

    os.makedirs(BUILD_DIR, exist_ok=True)
    cmd = ["gcc", "-std=c11", "-Wall", "-Wextra", "-O0", "-g", "-shared", "-fPIC"]
    cmd += [f"-I{os.path.join(SRC_DIR, m)}" for m in MODULE_DIRS]
    cmd += sources + ["-o", LIB_PATH]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        sys.exit("[server] C 모듈 빌드 실패")
    return stubs


def load_library():
    lib = ctypes.CDLL(LIB_PATH)
    lib.VehicleController_Init.restype = None
    lib.VehicleController_Init.argtypes = []
    lib.VehicleController_SetInputs.restype = None
    lib.VehicleController_SetInputs.argtypes = [ctypes.POINTER(VehicleInputs), ctypes.c_uint16]
    lib.VehicleController_Step.restype = None
    lib.VehicleController_Step.argtypes = [ctypes.c_uint32]
    lib.VehicleController_GetOutputs.restype = None
    lib.VehicleController_GetOutputs.argtypes = [ctypes.POINTER(VehicleOutputs)]
    lib.Bridge_SizeofInputs.restype = ctypes.c_uint32
    lib.Bridge_SizeofOutputs.restype = ctypes.c_uint32

    # ctypes 구조체 배치가 C와 같은지 확인 (다르면 값이 엉뚱하게 전달되므로 시작하지 않음)
    def check(name, cls, size_fn, offsets_fn):
        n = len(cls._fields_)
        offs = (ctypes.c_uint32 * n)()
        offsets_fn(offs)
        mine = [getattr(cls, f[0]).offset for f in cls._fields_]
        if size_fn() != ctypes.sizeof(cls) or list(offs) != mine:
            sys.exit(f"[server] {name} 구조체 배치가 C와 다릅니다: C={list(offs)} py={mine}")

    check("VehicleInputs_t", VehicleInputs, lib.Bridge_SizeofInputs, lib.Bridge_InputOffsets)
    check("VehicleOutputs_t", VehicleOutputs, lib.Bridge_SizeofOutputs, lib.Bridge_OutputOffsets)
    return lib


# ---------------------------------------------------------------- engine
class Engine:
    """50 ms 주기로 Step을 돌리고 출력 메시지를 모든 클라이언트에 보낸다."""

    def __init__(self, lib):
        self.lib = lib
        self.lock = threading.Lock()
        self.clients = set()
        self.clients_lock = threading.Lock()
        self._reset_locked()

    def _reset_locked(self):
        self.lib.VehicleController_Init()
        self.tick = 0
        self.t0 = time.monotonic()

    def reset(self):
        with self.lock:
            self._reset_locked()

    def set_inputs(self, signals):
        """18 시트: 메시지에 들어 있는 필드만 mask 비트를 1로 하여 SetInputs 호출. 모르는 필드는 무시."""
        if not isinstance(signals, dict):
            return
        inp = VehicleInputs()
        mask = 0
        for key, value in signals.items():
            spec = INPUT_FIELDS.get(key)
            if spec is None:
                continue
            field, bit, conv = spec
            converted = conv(value)
            if converted is None:
                continue
            setattr(inp, field, converted)
            mask |= bit
        if mask:
            with self.lock:
                self.lib.VehicleController_SetInputs(ctypes.byref(inp), mask)

    def run(self):
        while True:
            with self.lock:
                now_ms = self.tick * MAIN_CYCLE_MS
                self.lib.VehicleController_Step(now_ms)
                out = VehicleOutputs()
                self.lib.VehicleController_GetOutputs(ctypes.byref(out))
                self.tick += 1
                next_at = self.t0 + self.tick * MAIN_CYCLE_MS / 1000.0
            self.broadcast(output_message(now_ms, out))
            delay = next_at - time.monotonic()
            if delay > 0:
                time.sleep(delay)

    def broadcast(self, msg):
        data = json.dumps(msg)
        with self.clients_lock:
            clients = list(self.clients)
        for c in clients:
            c.send_text(data)


def output_message(now_ms, out):
    """18 시트 출력 메시지 (VehicleController → UI)."""
    def enum_name(table, v):
        return table[v] if 0 <= v < len(table) else str(v)

    return {
        "type": "output",
        "time_ms": now_ms,
        "headlamp_on": bool(out.headlamp_on),
        "wiper_level": enum_name(WIPER_LEVEL, out.wiper_level),
        "door_locked": bool(out.door_locked),
        "cluster_warning": enum_name(CLUSTER_WARNING, out.cluster_warning),
        "ambient_light_sensor_fault": bool(out.ambient_light_sensor_fault),
        "rain_sensor_fault": bool(out.rain_sensor_fault),
        "vehicle_speed_valid": bool(out.vehicle_speed_valid),
        "vehicle_state_timeout": bool(out.vehicle_state_timeout),
    }


# ---------------------------------------------------------------- WebSocket (RFC 6455, 최소 구현)
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class WsConnection:
    def __init__(self, sock):
        self.sock = sock
        self.send_lock = threading.Lock()
        self.alive = True

    def _send_frame(self, opcode, payload):
        header = bytes([0x80 | opcode])
        n = len(payload)
        if n < 126:
            header += bytes([n])
        elif n < 65536:
            header += bytes([126]) + struct.pack("!H", n)
        else:
            header += bytes([127]) + struct.pack("!Q", n)
        with self.send_lock:
            if not self.alive:
                return
            try:
                self.sock.sendall(header + payload)
            except OSError:
                self.alive = False

    def send_text(self, text):
        self._send_frame(0x1, text.encode("utf-8"))

    def _recv_exact(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError
            buf += chunk
        return buf

    def recv_message(self):
        """텍스트 메시지 1개를 돌려준다. 연결이 끝나면 None."""
        parts = []
        while True:
            b1, b2 = self._recv_exact(2)
            fin, opcode = b1 & 0x80, b1 & 0x0F
            n = b2 & 0x7F
            if n == 126:
                n = struct.unpack("!H", self._recv_exact(2))[0]
            elif n == 127:
                n = struct.unpack("!Q", self._recv_exact(8))[0]
            mask = self._recv_exact(4) if b2 & 0x80 else b"\0\0\0\0"
            data = bytes(x ^ mask[i % 4] for i, x in enumerate(self._recv_exact(n)))
            if opcode == 0x8:  # close
                self._send_frame(0x8, b"")
                return None
            if opcode == 0x9:  # ping
                self._send_frame(0xA, data)
                continue
            if opcode == 0xA:  # pong
                continue
            parts.append(data)
            if fin:
                return b"".join(parts).decode("utf-8", errors="replace")


class Handler(SimpleHTTPRequestHandler):
    engine = None
    stubs = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/ws" and self.headers.get("Upgrade", "").lower() == "websocket":
            self.handle_websocket()
        else:
            super().do_GET()

    def handle_websocket(self):
        key = self.headers.get("Sec-WebSocket-Key", "")
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        super().end_headers()
        self.wfile.flush()
        self.close_connection = True

        self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        conn = WsConnection(self.connection)
        conn.send_text(json.dumps({"type": "hello", "stubs": self.stubs, "step_ms": MAIN_CYCLE_MS}))
        with self.engine.clients_lock:
            self.engine.clients.add(conn)
        try:
            while conn.alive:
                text = conn.recv_message()
                if text is None:
                    break
                self.handle_message(text)
        except (ConnectionError, OSError):
            pass
        finally:
            conn.alive = False
            with self.engine.clients_lock:
                self.engine.clients.discard(conn)

    def handle_message(self, text):
        try:
            msg = json.loads(text)
        except ValueError:
            return
        if not isinstance(msg, dict):
            return
        if msg.get("type") == "input":
            self.engine.set_inputs(msg.get("signals"))
        elif msg.get("type") == "reset":
            self.engine.reset()
            self.engine.broadcast({"type": "reset_done"})


def main():
    ap = argparse.ArgumentParser(description="VBC 웹 UI 브리지 서버")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()

    stubs = build_library()
    lib = load_library()
    engine = Engine(lib)
    Handler.engine = engine
    Handler.stubs = stubs

    threading.Thread(target=engine.run, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    if stubs:
        print(f"[server] [임시] 스텁 사용 중: {', '.join(stubs)} (실제 .c가 들어오면 자동 해제)", flush=True)
    print(f"[server] http://{args.host}:{args.port}/ 에서 UI를 여세요 (종료: Ctrl+C)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
