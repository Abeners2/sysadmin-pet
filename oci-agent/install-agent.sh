#!/bin/bash
# ==============================================================================
# SysAdmin Pet — 1-Line Standalone Linux Telemetry Agent Installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Abeners2/sysadmin-pet/main/oci-agent/install-agent.sh | sudo bash
#   Or locally: sudo bash oci-agent/install-agent.sh
# ==============================================================================
set -e

export DEBIAN_FRONTEND=noninteractive
PORT="${AGENT_PORT:-8080}"
BIND_ADDR="${AGENT_BIND:-0.0.0.0}"
API_KEY="${SYSADMIN_PET_API_KEY:-}"

echo "--> [1/3] Installing Python3 & venv dependencies..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv curl

echo "--> [2/3] Creating dedicated non-root system user (oci-agent)..."
if ! id -u oci-agent >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin oci-agent
fi

mkdir -p /opt/oci-tamagotchi-agent
if [ ! -d /opt/oci-tamagotchi-agent/venv ]; then
    python3 -m venv /opt/oci-tamagotchi-agent/venv
fi
/opt/oci-tamagotchi-agent/venv/bin/pip install -q flask psutil gunicorn

cat << 'PYEOF' > /opt/oci-tamagotchi-agent/oci_agent.py
import os
import time
from flask import Flask, Response, jsonify, request
import psutil

app = Flask(__name__)
API_KEY = os.environ.get("SYSADMIN_PET_API_KEY", "").strip()

_last_net = psutil.net_io_counters()
_last_net_time = time.time()

def _is_authorized():
    if not API_KEY:
        return True
    return request.headers.get("X-API-Key", "") == API_KEY

def get_network_kbs():
    global _last_net, _last_net_time
    now = time.time()
    cur_net = psutil.net_io_counters()
    dt = max(0.1, now - _last_net_time)
    rx_kbs = round((cur_net.bytes_recv - _last_net.bytes_recv) / 1024.0 / dt)
    tx_kbs = round((cur_net.bytes_sent - _last_net.bytes_sent) / 1024.0 / dt)
    _last_net = cur_net
    _last_net_time = now
    return max(0, rx_kbs), max(0, tx_kbs)

def get_top_process():
    top_name = "system"
    top_mem = 0.0
    for proc in psutil.process_iter(["name", "memory_percent"]):
        try:
            mem = proc.info.get("memory_percent") or 0.0
            if mem > top_mem:
                top_mem = mem
                top_name = proc.info.get("name") or "proc"
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    clean_name = top_name.replace("google-chrome-stable", "chrome").replace("chromium-browser", "chrome")
    return f"{clean_name[:10]} ({round(top_mem)}%)"

def get_uptime_seconds():
    return max(0, int(time.time() - psutil.boot_time()))

def format_uptime(uptime_seconds):
    days = uptime_seconds // 86400
    hours = (uptime_seconds % 86400) // 3600
    mins = (uptime_seconds % 3600) // 60
    return f"{days}d {hours}h" if days > 0 else f"{hours}h {mins}m"

@app.route("/health", methods=["GET"])
def health_check():
    if not _is_authorized():
        return jsonify({"status": "unauthorized"}), 401
    cpu_usage = round(psutil.cpu_percent(interval=0.25))
    vm = psutil.virtual_memory()
    ram_used_mb = round((vm.total - vm.available) / (1024 * 1024))
    ram_total_mb = round(vm.total / (1024 * 1024))
    rx_kbs, tx_kbs = get_network_kbs()
    return jsonify({
        "cpu": cpu_usage,
        "ram": round(vm.percent),
        "ram_mb": f"{ram_used_mb}/{ram_total_mb}M",
        "swap": round(psutil.swap_memory().percent),
        "disk": round(psutil.disk_usage("/").percent),
        "rx_kbs": rx_kbs,
        "tx_kbs": tx_kbs,
        "uptime": format_uptime(get_uptime_seconds()),
        "top": get_top_process(),
        "status": "online"
    }), 200
PYEOF

chown -R oci-agent:oci-agent /opt/oci-tamagotchi-agent

echo "--> [3/3] Enabling systemd service (oci-tamagotchi.service) on ${BIND_ADDR}:${PORT}..."
cat << SVCEOF > /etc/systemd/system/oci-tamagotchi.service
[Unit]
Description=Lightweight Telemetry Agent (SysAdmin Pet)
After=network.target

[Service]
User=oci-agent
Group=oci-agent
WorkingDirectory=/opt/oci-tamagotchi-agent
Environment="SYSADMIN_PET_API_KEY=${API_KEY}"
ExecStart=/opt/oci-tamagotchi-agent/venv/bin/gunicorn --workers 1 --threads 2 --bind ${BIND_ADDR}:${PORT} oci_agent:app
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable oci-tamagotchi.service
systemctl restart oci-tamagotchi.service

PUBLIC_IP=$(curl -s --max-time 4 ifconfig.me || hostname -I | awk '{print $1}')
echo "=================================================================="
echo "✅ SysAdmin Pet Agent is LIVE!"
echo "👉 In your Zepp Mobile App (SysAdmin Pet -> Settings), enter:"
echo "   Server URL: http://${PUBLIC_IP}:${PORT}/health"
echo "=================================================================="
