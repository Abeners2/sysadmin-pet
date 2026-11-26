import { BaseSideService } from '@zeppos/zml/base-side'
import { PRIMARY_ENDPOINT, FALLBACK_ENDPOINT, API_KEY } from './config'

async function queryEndpoint(url) {
  const headers = {
    'Accept': 'application/json'
  }
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY
  }

  const startMs = Date.now()
  const response = await fetch({
    url,
    method: 'GET',
    headers
  })
  // Subtract the 250ms psutil sampling window on the server to estimate real network RTT
  const elapsedMs = Math.max(8, (Date.now() - startMs) - 250)

  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP_${response ? response.status : 'ERR'}`)
  }

  const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
  if (typeof body.cpu === 'undefined' || typeof body.ram === 'undefined') {
    throw new Error('INVALID_PAYLOAD')
  }

  return {
    cpu: Number(body.cpu) || 0,
    ram: Number(body.ram) || 0,
    ram_mb: body.ram_mb || '--',
    swap: Number(body.swap) || 0,
    disk: Number(body.disk) || 0,
    rx_kbs: Number(body.rx_kbs) || 0,
    tx_kbs: Number(body.tx_kbs) || 0,
    ping: elapsedMs,
    uptime: body.uptime || '--',
    top: body.top || '--',
    status: body.status || 'offline'
  }
}

AppSideService(
  BaseSideService({
    onInit() {},

    async onRequest(req, res) {
      if (req.method === 'GET_OCI_HEALTH') {
        try {
          const data = await queryEndpoint(PRIMARY_ENDPOINT)
          res(null, data)
        } catch (primaryErr) {
          if (FALLBACK_ENDPOINT) {
            try {
              const fallbackData = await queryEndpoint(FALLBACK_ENDPOINT)
              res(null, fallbackData)
              return
            } catch (fallbackErr) {
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
                status: 'offline',
                error: fallbackErr.message || 'OFFLINE'
              })
              return
            }
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
