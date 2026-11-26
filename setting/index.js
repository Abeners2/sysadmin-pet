AppSettingsPage({
  build(props) {
    const mode = props.settingsStorage.getItem('monitor_mode') || 'auto'
    const endpointUrl = props.settingsStorage.getItem('endpoint_url') || ''
    const apiKey = props.settingsStorage.getItem('api_key') || ''
    const serverLabel = props.settingsStorage.getItem('server_label') || ''

    return View(
      {
        style: {
          padding: '16px',
          backgroundColor: '#0f172a',
          minHeight: '100vh',
          color: '#f8fafc',
          fontFamily: 'sans-serif'
        }
      },
      [
        // Header Banner
        View(
          {
            style: {
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#1e293b',
              marginBottom: '16px',
              border: '1px solid #334155'
            }
          },
          [
            Text(
              {
                style: {
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#10b981',
                  display: 'block',
                  marginBottom: '6px'
                }
              },
              '🦖 SysAdmin Pet — NOC HUD'
            ),
            Text(
              {
                style: {
                  fontSize: '13px',
                  color: '#94a3b8',
                  lineHeight: '1.4'
                }
              },
              'Configure your server endpoint directly from the Zepp App. Supports Full Linux Agent (/health), Zero-Install HTTP/Website Ping, Netdata (/api/v1/info), or Store Demo Mode.'
            )
          ]
        ),

        // Mode Selection Card
        Section(
          {
            title: '1. Monitoring Mode',
            style: {
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px'
            }
          },
          [
            Select({
              title: 'Select Telemetry Source',
              value: mode,
              options: [
                { name: 'Auto-Detect (Agent JSON or HTTP Ping)', value: 'auto' },
                { name: 'Full Linux Agent (/health JSON)', value: 'agent' },
                { name: 'Zero-Install Website / API Ping (Any URL)', value: 'http_ping' },
                { name: 'Netdata API (http://ip:19999)', value: 'netdata' },
                { name: 'Interactive Demo Mode (No Server Needed)', value: 'demo' }
              ],
              onChange: (val) => {
                props.settingsStorage.setItem('monitor_mode', val)
              }
            }),
            Text(
              {
                style: {
                  fontSize: '12px',
                  color: '#38bdf8',
                  marginTop: '8px',
                  display: 'block'
                }
              },
              `Active Mode: ${mode.toUpperCase()}`
            )
          ]
        ),

        // Endpoint Configuration Card
        Section(
          {
            title: '2. Server Connection',
            style: {
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px'
            }
          },
          [
            TextInput({
              label: 'Server URL / Endpoint (Leave blank to use local config.js)',
              placeholder: 'http://203.0.113.10/health or https://example.com',
              value: endpointUrl,
              onChange: (val) => {
                props.settingsStorage.setItem('endpoint_url', (val || '').trim())
              }
            }),
            View({ style: { height: '10px' } }),
            TextInput({
              label: 'Optional X-API-Key (For protected /health endpoints)',
              placeholder: 'Leave empty if public',
              value: apiKey,
              onChange: (val) => {
                props.settingsStorage.setItem('api_key', (val || '').trim())
              }
            }),
            View({ style: { height: '10px' } }),
            TextInput({
              label: 'Watch Footer Label',
              placeholder: 'e.g. OCI • E2.1.Micro or PROD • API',
              value: serverLabel,
              onChange: (val) => {
                props.settingsStorage.setItem('server_label', (val || '').trim())
              }
            })
          ]
        ),

        // Quick Presets Card
        Section(
          {
            title: '3. Quick Actions',
            style: {
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px'
            }
          },
          [
            View(
              {
                style: {
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '10px',
                  marginTop: '8px'
                }
              },
              [
                Button({
                  label: 'Try Demo Mode',
                  style: {
                    backgroundColor: '#f59e0b',
                    color: '#0f172a',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    border: 'none'
                  },
                  onClick: () => {
                    props.settingsStorage.setItem('monitor_mode', 'demo')
                  }
                }),
                Button({
                  label: 'Use Local config.js',
                  style: {
                    backgroundColor: '#10b981',
                    color: '#0f172a',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    border: 'none'
                  },
                  onClick: () => {
                    props.settingsStorage.setItem('monitor_mode', 'auto')
                    props.settingsStorage.setItem('endpoint_url', '')
                  }
                })
              ]
            )
          ]
        )
      ]
    )
  }
})
