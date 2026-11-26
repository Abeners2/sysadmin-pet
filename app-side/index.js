import { BaseSideService } from '@zeppos/zml/base-side'
import { PRIMARY_ENDPOINT, FALLBACK_ENDPOINT, API_KEY } from './config'

let demoTick = 0

function getSetting(key, fallback = '') {
  try {
    if (typeof settings !== 'undefined' && settings.settingsStorage) {
      const val = settings.settingsStorage.getItem(key)
      if (val !== null && typeof val !== 'undefined' && String(val).trim() !== '') {
        return String(val).trim()
      }
    }
  } catch (e) {}
  return fallback
}

function extractHostLabel(url) {
  try {
    const clean = url.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0]
    return clean.length > 18 ? clean.slice(0, 18) : clean
  } catch (e) {
    return 'REMOTE-HOST'
  }
}

/**
 * Interactive Store Demo Mode (cycles through Zen -> Working -> Panic -> Zen)
 * Ensures Zepp Store reviewers and first-time users see a live animated HUD immediately.
 */
function generateDemoPayload(customLabel) {
  demoTick = (demoTick + 1) % 12
  // Ticks 0..5: Zen | Ticks 6..8: Working | Ticks 9..11: Panic
  let cpu = 14 + (demoTick * 2)
  let ram = 48 + demoTick
  let swap = 22
  let top = 'nginx (4%)'

  if (demoTick >= 6 && demoTick <= 8) {
    cpu = 62 + (demoTick - 6) * 7
    ram = 74 + (demoTick - 6) * 3
    swap = 35
    top = 'node (24%)'
  } else if (demoTick >= 9) {
    cpu = 91 + (demoTick - 9) * 3
    ram = 92
    swap = 68
    top = 'chrome (46%)'
  }

  const usedMb = Math.round((ram / 100) * 956)
  return {
    cpu,
    ram,
    ram_mb: `${usedMb}/956M`,
    swap,
    disk: 29,
    rx_kbs: 12 + demoTick * 3,
    tx_kbs: 5 + demoTick * 2,
    ping: 24 + (demoTick % 5) * 3,
    uptime: '14d 08h',
    top,
    label: customLabel || 'DEMO • STORE MODE',
    mode: 'demo',
    status: 'online'
  }
}

/**
 * Queries either the Full Linux Agent (/health) or any generic HTTP/HTTPS URL (Zero-Install Ping Mode)
 */
async function queryEndpoint(url, apiKey, mode, customLabel) {
  const headers = {
    'Accept': 'application/json, text/plain, */*'
  }
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  const startMs = Date.now()
  const response = await fetch({
    url,
    method: 'GET',
    headers
  })
  const rawElapsedMs = Math.max(8, Date.now() - startMs)

  if (!response || response.status < 200 || response.status >= 400) {
    throw new Error(`HTTP_${response ? response.status : 'ERR'}`)
  }

  let body = null
  try {
    body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
  } catch (e) {
    body = null
  }

  // Case 1: Full Linux Agent JSON payload detected ({ cpu, ram, ... })
  if (mode !== 'http_ping' && body && typeof body.cpu !== 'undefined' && typeof body.ram !== 'undefined') {
    const agentPing = Math.max(8, rawElapsedMs - 250)
    return {
      cpu: Number(body.cpu) || 0,
      ram: Number(body.ram) || 0,
      ram_mb: body.ram_mb || '--',
      swap: Number(body.swap) || 0,
      disk: Number(body.disk) || 0,
      rx_kbs: Number(body.rx_kbs) || 0,
      tx_kbs: Number(body.tx_kbs) || 0,
      ping: agentPing,
      uptime: body.uptime || 'ONLINE',
      top: body.top || '--',
      label: customLabel || 'OCI • E2.1.Micro',
      mode: 'agent',
      status: body.status || 'online'
    }
  }

  // Case 2: Zero-Install HTTP Website / API Ping Mode (works on ANY URL without installing an agent!)
  // Maps latency (ms) into the Tamagotchi stress thresholds (<250ms Zen, 250-800ms Working, >800ms Panic)
  let latencyStress = 15
  if (rawElapsedMs <= 250) {
    latencyStress = Math.min(38, Math.max(5, Math.round((rawElapsedMs / 250) * 38)))
  } else if (rawElapsedMs <= 800) {
    latencyStress = 42 + Math.min(42, Math.round(((rawElapsedMs - 250) / 550) * 42))
  } else {
    latencyStress = Math.min(99, 88 + Math.round((rawElapsedMs - 800) / 200))
  }

  const hostName = extractHostLabel(url)
  return {
    cpu: latencyStress,
    ram: response.status === 200 ? 25 : 65,
    ram_mb: `HTTP ${response.status}`,
    swap: Math.min(100, Math.round(rawElapsedMs / 12)),
    disk: 100,
    rx_kbs: 1,
    tx_kbs: 1,
    ping: rawElapsedMs,
    uptime: 'HTTP OK',
    top: `${hostName} (${rawElapsedMs}ms)`,
    label: customLabel || `PING • ${hostName}`,
    mode: 'http_ping',
    status: 'online'
  }
}

/**
 * Native Netdata integration (queries /api/v1/data on a standard Netdata instance)
 */
async function queryNetdata(baseUrl, customLabel) {
  const cleanBase = baseUrl.replace(/\/+$/, '')
  const startMs = Date.now()
  const cpuRes = await fetch({
    url: `${cleanBase}/api/v1/data?chart=system.cpu&points=1&format=json`,
    method: 'GET'
  })
  const ping = Math.max(8, Date.now() - startMs)
  if (!cpuRes || cpuRes.status !== 200) {
    throw new Error('NETDATA_ERR')
  }
  const cpuBody = typeof cpuRes.body === 'string' ? JSON.parse(cpuRes.body) : cpuRes.body
  const row = (cpuBody && cpuBody.data && cpuBody.data[0]) || []
  const cpuTotal = Math.min(100, Math.max(0, Math.round(row.slice(1).reduce((a, b) => a + (Number(b) || 0), 0))))

  return {
    cpu: cpuTotal,
    ram: 45,
    ram_mb: 'NETDATA',
    swap: 10,
    disk: 30,
    rx_kbs: 0,
    tx_kbs: 0,
    ping,
    uptime: 'LIVE',
    top: `netdata (${cpuTotal}%)`,
    label: customLabel || `NETDATA • ${extractHostLabel(cleanBase)}`,
    mode: 'netdata',
    status: 'online'
  }
}

AppSideService(
  BaseSideService({
    onInit() {},

    async onRequest(req, res) {
      if (req.method === 'GET_OCI_HEALTH') {
        const mode = getSetting('monitor_mode', 'auto')
        const customUrl = getSetting('endpoint_url', '')
        const activeApiKey = getSetting('api_key', API_KEY)
        const customLabel = getSetting('server_label', '')

        const targetUrl = customUrl || PRIMARY_ENDPOINT
        const isPlaceholder = !targetUrl || targetUrl.indexOf('YOUR_OCI_VM_PUBLIC_IP') !== -1

        // If user selected Demo Mode OR hasn't configured an endpoint yet, run Store Demo Mode
        if (mode === 'demo' || isPlaceholder) {
          res(null, generateDemoPayload(customLabel))
          return
        }

        try {
          if (mode === 'netdata') {
            const netdataData = await queryNetdata(targetUrl, customLabel)
            res(null, netdataData)
            return
          }

          const data = await queryEndpoint(targetUrl, activeApiKey, mode, customLabel)
          res(null, data)
        } catch (primaryErr) {
          if (!customUrl && FALLBACK_ENDPOINT) {
            try {
              const fallbackData = await queryEndpoint(FALLBACK_ENDPOINT, activeApiKey, mode, customLabel)
              res(null, fallbackData)
              return
            } catch (fallbackErr) {}
          }
          res(null, {
            cpu: 0,
            ram: 0,
            swap: 0,
            disk: 0,
            rx_kbs: 0,
            tx_kbs: 0,
            ping: 0,
            uptime: 'OFFLINE',
            top: 'no signal',
            label: customLabel || 'OCI • E2.1.Micro',
            mode,
            status: 'offline',
            error: primaryErr.message || 'OFFLINE'
          })
        }
      }
    },

    onRun() {},
    onDestroy() {}
  })
)
