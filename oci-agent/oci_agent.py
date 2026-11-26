import os
import time
from flask import Flask, Response, jsonify, request
import psutil

app = Flask(__name__)

API_KEY = os.environ.get("SYSADMIN_PET_API_KEY", "").strip()

# Track previous network counter reading for instantaneous KB/s calculation
_last_net = psutil.net_io_counters()
_last_net_time = time.time()


def _is_authorized():
    if not API_KEY:
        return True
    provided = request.headers.get("X-API-Key", "")
    return provided == API_KEY


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
    if len(clean_name) > 10:
        clean_name = clean_name[:10]
    return f"{clean_name} ({round(top_mem)}%)"


def get_uptime_seconds():
    return max(0, int(time.time() - psutil.boot_time()))


def format_uptime(uptime_seconds):
    days = uptime_seconds // 86400
    hours = (uptime_seconds % 86400) // 3600
    mins = (uptime_seconds % 3600) // 60
    if days > 0:
        return f"{days}d {hours}h"
    return f"{hours}h {mins}m"


def collect_metrics():
    cpu_usage = round(psutil.cpu_percent(interval=0.25))
    vm = psutil.virtual_memory()
    ram_usage = round(vm.percent)
    ram_used_bytes = vm.total - vm.available
    ram_used_mb = round(ram_used_bytes / (1024 * 1024))
    ram_total_mb = round(vm.total / (1024 * 1024))

    swap = psutil.swap_memory()
    swap_usage = round(swap.percent)

    disk = psutil.disk_usage("/")
    disk_usage = round(disk.percent)

    rx_kbs, tx_kbs = get_network_kbs()
    uptime_seconds = get_uptime_seconds()

    return {
        "cpu": cpu_usage,
        "ram": ram_usage,
        "ram_used_bytes": ram_used_bytes,
        "ram_total_bytes": vm.total,
        "ram_mb": f"{ram_used_mb}/{ram_total_mb}M",
        "swap": swap_usage,
        "disk": disk_usage,
        "rx_kbs": rx_kbs,
        "tx_kbs": tx_kbs,
        "uptime_seconds": uptime_seconds,
        "uptime": format_uptime(uptime_seconds),
        "top": get_top_process(),
        "status": "online",
    }


@app.route("/health", methods=["GET"])
def health_check():
    if not _is_authorized():
        return jsonify({"status": "unauthorized"}), 401
    try:
        m = collect_metrics()
        return jsonify({
            "cpu": m["cpu"],
            "ram": m["ram"],
            "ram_mb": m["ram_mb"],
            "swap": m["swap"],
            "disk": m["disk"],
            "rx_kbs": m["rx_kbs"],
            "tx_kbs": m["tx_kbs"],
            "uptime": m["uptime"],
            "top": m["top"],
            "status": m["status"],
        }), 200
    except Exception as e:
        return jsonify({
            "cpu": 0,
            "ram": 0,
            "status": "error",
            "message": str(e),
        }), 500


@app.route("/metrics", methods=["GET"])
def prometheus_metrics():
    """Zero-overhead Prometheus text exposition endpoint for remote scraping."""
    if not _is_authorized():
        return Response("unauthorized\n", status=401, mimetype="text/plain")
    try:
        m = collect_metrics()
        lines = [
            "# HELP sysadmin_cpu_usage_percent Current CPU utilization percentage.",
            "# TYPE sysadmin_cpu_usage_percent gauge",
            f"sysadmin_cpu_usage_percent {m['cpu']}",
            "# HELP sysadmin_ram_usage_percent Current RAM utilization percentage.",
            "# TYPE sysadmin_ram_usage_percent gauge",
            f"sysadmin_ram_usage_percent {m['ram']}",
            "# HELP sysadmin_ram_used_bytes Current RAM used in bytes.",
            "# TYPE sysadmin_ram_used_bytes gauge",
            f"sysadmin_ram_used_bytes {m['ram_used_bytes']}",
            "# HELP sysadmin_swap_usage_percent Current Swap utilization percentage.",
            "# TYPE sysadmin_swap_usage_percent gauge",
            f"sysadmin_swap_usage_percent {m['swap']}",
            "# HELP sysadmin_disk_usage_percent Root filesystem utilization percentage.",
            "# TYPE sysadmin_disk_usage_percent gauge",
            f"sysadmin_disk_usage_percent {m['disk']}",
            "# HELP sysadmin_net_rx_kbs Network receive throughput in KB/s.",
            "# TYPE sysadmin_net_rx_kbs gauge",
            f"sysadmin_net_rx_kbs {m['rx_kbs']}",
            "# HELP sysadmin_net_tx_kbs Network transmit throughput in KB/s.",
            "# TYPE sysadmin_net_tx_kbs gauge",
            f"sysadmin_net_tx_kbs {m['tx_kbs']}",
            "# HELP sysadmin_uptime_seconds System uptime in seconds.",
            "# TYPE sysadmin_uptime_seconds counter",
            f"sysadmin_uptime_seconds {m['uptime_seconds']}",
        ]
        return Response("\n".join(lines) + "\n", status=200, mimetype="text/plain; version=0.0.4")
    except Exception as e:
        return Response(f"# error: {e}\n", status=500, mimetype="text/plain")


if __name__ == "__main__":
    host = os.environ.get("AGENT_HOST", "127.0.0.1")
    port = int(os.environ.get("AGENT_PORT", "8080"))
    app.run(host=host, port=port, debug=False)
