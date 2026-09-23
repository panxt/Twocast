#!/usr/bin/env python3
"""Manage this checkout's local Twocast services; never removes container data."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

SCRIPT = Path(__file__).resolve()
ROOT = SCRIPT.parent.parent
STATE = ROOT / ".local"
PID_FILE = STATE / "supervisor.json"
CHILD_FILE = STATE / "processes.json"
URL = "http://127.0.0.1:3000"
REQUIRED_SERVICES = ("postgres", "redis", "textract", "ffmpeg-api")


def read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def write_json(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def ps(pid, field):
    result = subprocess.run(
        ["ps", "-p", str(pid), "-o", field + "="],
        capture_output=True, text=True,
        env=dict(os.environ, LC_ALL="C"),
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def process_record(pid):
    return {"pid": pid, "started": ps(pid, "lstart")}


def alive(record):
    pid = record.get("pid")
    return bool(pid and record.get("started") and ps(pid, "lstart") == record["started"])


def supervisor_alive():
    record = read_json(PID_FILE)
    if not alive(record):
        return False
    command = ps(record["pid"], "command")
    try:
        return str(SCRIPT) in command and "_supervise" in command and os.getpgid(record["pid"]) == record["pid"]
    except ProcessLookupError:
        return False


def node_binary():
    saved = STATE / "node-path"
    candidates = [os.environ.get("TWOCAST_NODE")]
    if saved.exists():
        candidates.append(saved.read_text().strip())
    candidates.append(shutil.which("node"))
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            result = subprocess.run([candidate, "--version"], capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip().startswith("v22."):
                return str(Path(candidate).resolve())
    raise RuntimeError("Node.js 22 not found. Set TWOCAST_NODE or save its absolute path in .local/node-path.")


def compose(*arguments, check=True, capture_output=False):
    docker = shutil.which("docker")
    if not docker:
        raise RuntimeError("Docker CLI not found; start Docker Desktop and check PATH.")
    return subprocess.run(
        [docker, "compose", "--project-name", "twocast-local", "--file", str(ROOT / "compose.local.yaml"), *arguments],
        cwd=ROOT, check=check, capture_output=capture_output, text=True,
    )


def environment(node):
    env = dict(os.environ)
    env["PATH"] = str(Path(node).parent) + os.pathsep + env.get("PATH", "")
    env["NODE_ENV"] = "development"
    env["NEXT_TELEMETRY_DISABLED"] = "1"
    env["DOTENV_CONFIG_PATH"] = str(ROOT / ".env")
    # The user's machine has an outbound HTTP proxy (127.0.0.1:7890) intended
    # for overseas domains. That proxy does not understand Chinese endpoints
    # like api.minimaxi.com and returns "400 The plain HTTP request was sent
    # to HTTPS port". Strip proxy envs so Next.js / tsx children hit the
    # network directly for the China-region Minimax API.
    for proxy_key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy",
                      "ALL_PROXY", "all_proxy"):
        env.pop(proxy_key, None)
    return env


def supervise():
    """Keep a stable process-group leader, so stop cannot hit unrelated processes."""
    stopping = False

    def request_stop(_signum, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    node = node_binary()
    env = environment(node)
    commands = {
        "web": [node, str(ROOT / "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3000"],
        "queue": [node, "--require", "dotenv/config", "--import", "tsx", "scripts/admin/queue.ts", "start"],
    }
    children, records, log_files = {}, {}, []
    try:
        for name, command in commands.items():
            log = (STATE / (name + ".log")).open("ab", buffering=0)
            log_files.append(log)
            child = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT)
            children[name] = child
            records[name] = process_record(child.pid)
        write_json(CHILD_FILE, records)
        while not stopping and any(child.poll() is None for child in children.values()):
            changed = False
            for name, child in children.items():
                code = child.poll()
                if code is not None and "exit_code" not in records[name]:
                    records[name]["exit_code"] = code
                    changed = True
            if changed:
                write_json(CHILD_FILE, records)
            time.sleep(0.5)
    finally:
        for child in children.values():
            if child.poll() is None:
                child.terminate()
        deadline = time.monotonic() + 10
        while any(child.poll() is None for child in children.values()) and time.monotonic() < deadline:
            time.sleep(0.2)
        for name, child in children.items():
            if child.poll() is None:
                child.kill()
            records[name]["exit_code"] = child.wait()
        write_json(CHILD_FILE, records)
        for log in log_files:
            log.close()


def start():
    if supervisor_alive():
        print("Twocast supervisor is already running; ensuring all containers are ready.")
        compose("up", "--detach", "--wait", "--wait-timeout", "180")
        print("Use restart to reload .env or restart stopped app processes.")
        return status()
    node_binary()
    for relative in (".env", "compose.local.yaml", "node_modules/next/dist/bin/next", "node_modules/tsx", "node_modules/dotenv"):
        if not (ROOT / relative).exists():
            raise RuntimeError("Missing " + relative + "; finish local setup before starting.")
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", 3000)) == 0:
            raise RuntimeError("Port 3000 is already in use by another process; free it before starting Twocast.")
    compose("up", "--detach", "--wait", "--wait-timeout", "180")
    CHILD_FILE.unlink(missing_ok=True)
    with (STATE / "supervisor.log").open("ab", buffering=0) as log:
        child = subprocess.Popen(
            [sys.executable, str(SCRIPT), "_supervise"], cwd=ROOT,
            stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
            start_new_session=True, close_fds=True,
        )
    write_json(PID_FILE, process_record(child.pid))
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline and child.poll() is None:
        try:
            with opener.open(URL, timeout=3) as response:
                if response.status < 500:
                    print("Twocast is available at " + URL)
                    return status()
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(1)
    print("Web readiness is not confirmed. Check .local/web.log and .local/supervisor.log.")
    status()
    return 1


def stop():
    record = read_json(PID_FILE)
    if supervisor_alive():
        pid = record["pid"]
        os.killpg(pid, signal.SIGTERM)
        deadline = time.monotonic() + 15
        while supervisor_alive() and time.monotonic() < deadline:
            time.sleep(0.2)
        if supervisor_alive():
            os.killpg(pid, signal.SIGKILL)
        print("Twocast app and queue stopped.")
    elif alive(record):
        raise RuntimeError("Saved PID does not match this Twocast supervisor; refusing to signal it.")
    else:
        print("Twocast app and queue are not running.")
    PID_FILE.unlink(missing_ok=True)
    compose("stop")
    print("Twocast containers stopped; database and uploaded files are retained.")
    return 0


def parse_compose_status(output):
    """Compose versions return either a JSON array/object or JSON Lines."""
    if not output.strip():
        return []
    try:
        rows = json.loads(output)
    except ValueError:
        rows = [json.loads(line) for line in output.splitlines() if line.strip()]
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError("Unexpected container status format")
    return rows


def status():
    healthy = supervisor_alive()
    print("Supervisor: " + ("running" if healthy else "stopped"))
    records = read_json(CHILD_FILE)
    for name in ("web", "queue"):
        record = records.get(name, {})
        running = bool(record) and "exit_code" not in record and alive(record)
        healthy = healthy and running
        detail = "running" if running else "stopped" if record else "missing process record"
        if "exit_code" in record:
            detail += " (exit " + str(record["exit_code"]) + ")"
        print(name + ": " + detail + "; log: .local/" + name + ".log")
    print("Local URL: " + URL)
    result = compose("ps", "--all", "--format", "json", check=False, capture_output=True)
    if result.returncode:
        print("Container status unavailable: " + result.stderr.strip())
        return 1
    try:
        rows = parse_compose_status(result.stdout)
    except ValueError:
        print("Container status unavailable: could not parse Docker Compose JSON output.")
        return 1
    for service in REQUIRED_SERVICES:
        containers = [row for row in rows if row.get("Service") == service]
        if not containers:
            print(service + ": missing")
            healthy = False
            continue
        details = []
        for container in containers:
            state = str(container.get("State") or "unknown").lower()
            health = str(container.get("Health") or "").lower()
            ready = state == "running" and (not health or health == "healthy")
            healthy = healthy and ready
            details.append(state + (" (health: " + health + ")" if health else ""))
        print(service + ": " + "; ".join(details))
    return 0 if healthy else 1


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["start", "stop", "restart", "status", "_supervise"])
    args = parser.parse_args()
    STATE.mkdir(mode=0o700, exist_ok=True)
    if args.command == "_supervise":
        supervise()
        return 0
    with (STATE / "control.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.command == "restart":
            stop()
            return start()
        return {"start": start, "stop": stop, "status": status}[args.command]()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, subprocess.CalledProcessError, OSError) as error:
        print("Twocast: " + str(error), file=sys.stderr)
        sys.exit(1)
