import { createWidget, widget, prop, align, text_style, event } from '@zos/ui'
import { setPageBrightTime, pauseDropWristScreenOff } from '@zos/display'
import { BasePage } from '@zeppos/zml/base-page'
import { px } from '@zos/utils'

// Resolução nativa do Amazfit T-Rex 3 (480x480 circular)
const SCREEN_W = 480
const SCREEN_H = 480
const PET_SIZE = 180

// Cores Táticas (AMOLED Neon)
const COLOR_BG_TRACK = 0x1e293b
const COLOR_CARD_BG = 0x0f172a
const COLOR_ZEN = 0x10b981       // Verde Neon
const COLOR_WORKING = 0xf59e0b   // Amarelo/Âmbar
const COLOR_PANIC = 0xef4444     // Vermelho Alerta
const COLOR_DEAD = 0x64748b      // Cinza Fantasma
const COLOR_SWAP = 0x38bdf8      // Azul Ciano
const COLOR_TEXT_SUB = 0x94a3b8  // Cinza Claro

// Intervalos
const ANIM_INTERVAL_MS = 220     // ~4.5 FPS para animação fluida do Mascote
const POLL_INTERVAL_MS = 3000    // Atualização em tempo real a cada 3 segundos
const TOTAL_FRAMES = 6

Page(
  BasePage({
    state: {
      currentAnimPrefix: 'zen',
      currentFrame: 0,
      animTimer: null,
      pollTimer: null,
      isLoading: false,
      heartbeatToggle: false,

      cpuArcWidget: null,
      ramArcWidget: null,
      swapArcWidget: null,
      uptimeTextWidget: null,
      netPingTextWidget: null,
      petImgWidget: null,
      cpuSideText: null,
      ramSideText: null,
      swapSideText: null,
      stateBannerWidget: null,
      primaryMetricsWidget: null,
      topProcTextWidget: null
    },

    onInit() {
      // Mantém a tela do T-Rex 3 acesa por 5 minutos para monitoramento contínuo
      try {
        setPageBrightTime({ brightTime: 300000 })
        pauseDropWristScreenOff({ duration: 300000 })
      } catch (e) {}
    },

    build() {
      // =========================================================================
      // 1. ARCOS TÁTICOS ESTRITAMENTE NAS LATERAIS (SEM INVADIR TOPO OU RODAPÉ)
      // =========================================================================

      // Trilha de fundo - Arco Esquerdo (CPU: 140° a 220° -> 80° de abertura lateral)
      createWidget(widget.ARC, {
        x: px(12),
        y: px(12),
        w: px(SCREEN_W - 24),
        h: px(SCREEN_H - 24),
        start_angle: 140,
        end_angle: 220,
        line_width: px(12),
        color: COLOR_BG_TRACK
      })

      // Arco Dinâmico Esquerdo (CPU)
      this.state.cpuArcWidget = createWidget(widget.ARC, {
        x: px(12),
        y: px(12),
        w: px(SCREEN_W - 24),
        h: px(SCREEN_H - 24),
        start_angle: 140,
        end_angle: 144,
        line_width: px(12),
        color: COLOR_ZEN
      })

      // Trilha de fundo - Arco Superior Direito (RAM: 318° a 356° -> 38° de abertura)
      createWidget(widget.ARC, {
        x: px(12),
        y: px(12),
        w: px(SCREEN_W - 24),
        h: px(SCREEN_H - 24),
        start_angle: 318,
        end_angle: 356,
        line_width: px(12),
        color: COLOR_BG_TRACK
      })

      // Arco Dinâmico Superior Direito (RAM)
      this.state.ramArcWidget = createWidget(widget.ARC, {
        x: px(12),
        y: px(12),
        w: px(SCREEN_W - 24),
        h: px(SCREEN_H - 24),
        start_angle: 318,
        end_angle: 322,
        line_width: px(12),
        color: COLOR_ZEN
      })

      // Trilha de fundo - Arco Inferior Direito (SWAP: 4° a 42° -> 38° de abertura)
      createWidget(widget.ARC, {
        x: px(12),
        y: px(12),
        w: px(SCREEN_W - 24),
        h: px(SCREEN_H - 24),
        start_angle: 4,
        end_angle: 42,
        line_width: px(12),
        color: COLOR_BG_TRACK
      })

      // Arco Dinâmico Inferior Direito (SWAP)
      this.state.swapArcWidget = createWidget(widget.ARC, {
        x: px(12),
        y: px(12),
        w: px(SCREEN_W - 24),
        h: px(SCREEN_H - 24),
        start_angle: 4,
        end_angle: 8,
        line_width: px(12),
        color: COLOR_SWAP
      })

      // =========================================================================
      // 2. TOPO LIMPO: UPTIME + LIVE + PING (ms) + TRÁFEGO DE REDE (RX/TX KB/s)
      // =========================================================================

      // Linha 1 (y=32): Largura segura de 240px centralizada no topo da tela redonda
      this.state.uptimeTextWidget = createWidget(widget.TEXT, {
        x: px(120),
        y: px(32),
        w: px(240),
        h: px(28),
        color: COLOR_ZEN,
        text_size: px(20),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: '● LIVE  •  UP --'
      })

      // Linha 2 (y=62): Ping em ms + Rede (RX/TX KB/s) com largura segura de 300px
      this.state.netPingTextWidget = createWidget(widget.TEXT, {
        x: px(90),
        y: px(62),
        w: px(300),
        h: px(28),
        color: COLOR_SWAP,
        text_size: px(19),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'PING --ms  •  ↓0 ↑0 KB/s'
      })

      // =========================================================================
      // 3. CENTRO: MASCOTE ANIMADO (6 FRAMES POR ESTADO) + INDICADORES LATERAIS
      // =========================================================================

      // Indicador Lateral Esquerdo (CPU)
      this.state.cpuSideText = createWidget(widget.TEXT, {
        x: px(32),
        y: px(162),
        w: px(106),
        h: px(54),
        color: COLOR_ZEN,
        text_size: px(20),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text: 'CPU\n--%'
      })

      // Indicador Lateral Direito Superior (RAM)
      this.state.ramSideText = createWidget(widget.TEXT, {
        x: px(342),
        y: px(126),
        w: px(106),
        h: px(54),
        color: COLOR_ZEN,
        text_size: px(20),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text: 'RAM\n--%'
      })

      // Indicador Lateral Direito Inferior (SWAP)
      this.state.swapSideText = createWidget(widget.TEXT, {
        x: px(342),
        y: px(198),
        w: px(106),
        h: px(54),
        color: COLOR_SWAP,
        text_size: px(20),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text: 'SWP\n--%'
      })

      // Mascote Central Animado (180x180)
      this.state.petImgWidget = createWidget(widget.IMG, {
        x: px((SCREEN_W - PET_SIZE) / 2),
        y: px(94),
        w: px(PET_SIZE),
        h: px(PET_SIZE),
        src: 'zen_0.png'
      })

      // Toque no mascote força atualização imediata
      this.state.petImgWidget.addEventListener(event.CLICK_UP, () => {
        this.fetchServerStatus()
      })

      // =========================================================================
      // 4. PAINEL INFERIOR: STATUS + RAM/DISCO + TOP PROCESSO (RAIO-X)
      // =========================================================================

      this.state.stateBannerWidget = createWidget(widget.TEXT, {
        x: px(60),
        y: px(278),
        w: px(SCREEN_W - 120),
        h: px(36),
        color: COLOR_ZEN,
        text_size: px(25),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'SINCRONIZANDO OCI...'
      })

      this.state.primaryMetricsWidget = createWidget(widget.TEXT, {
        x: px(50),
        y: px(316),
        w: px(SCREEN_W - 100),
        h: px(30),
        color: 0xffffff,
        text_size: px(20),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'RAM: --/--M  •  DISK: --%'
      })

      // Pílula de fundo do Raio-X (Top Processo)
      createWidget(widget.FILL_RECT, {
        x: px(95),
        y: px(354),
        w: px(290),
        h: px(40),
        radius: px(20),
        color: COLOR_CARD_BG
      })

      this.state.topProcTextWidget = createWidget(widget.TEXT, {
        x: px(100),
        y: px(354),
        w: px(280),
        h: px(40),
        color: COLOR_SWAP,
        text_size: px(20),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'TOP: analisando...'
      })

      // Rodapé com IP da instância OCI
      createWidget(widget.TEXT, {
        x: px(120),
        y: px(404),
        w: px(240),
        h: px(24),
        color: COLOR_TEXT_SUB,
        text_size: px(16),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
        text: 'OCI • E2.1.Micro'
      })

      this.startAnimationLoop()
      this.fetchServerStatus()
      this.startRealtimePolling()
    },

    startAnimationLoop() {
      if (this.state.animTimer) clearInterval(this.state.animTimer)
      this.state.animTimer = setInterval(() => {
        this.state.currentFrame = (this.state.currentFrame + 1) % TOTAL_FRAMES
        const spriteName = `${this.state.currentAnimPrefix}_${this.state.currentFrame}.png`
        if (this.state.petImgWidget) {
          this.state.petImgWidget.setProperty(prop.MORE, {
            src: spriteName
          })
        }
      }, ANIM_INTERVAL_MS)
    },

    startRealtimePolling() {
      if (this.state.pollTimer) clearInterval(this.state.pollTimer)
      this.state.pollTimer = setInterval(() => {
        this.fetchServerStatus()
      }, POLL_INTERVAL_MS)
    },

    evaluatePetState(data) {
      if (!data || data.status !== 'online') {
        return {
          animPrefix: 'dead',
          banner: '💀 SERVIDOR OFFLINE 💀',
          color: COLOR_DEAD,
          cpu: 0,
          ram: 0,
          swap: 0,
          disk: 0,
          rx_kbs: 0,
          tx_kbs: 0,
          ping: 0,
          uptime: 'OFFLINE',
          ram_mb: '0/0M',
          top: 'sem conexão'
        }
      }

      const cpu = Math.min(100, Math.max(0, Number(data.cpu) || 0))
      const ram = Math.min(100, Math.max(0, Number(data.ram) || 0))
      const swap = Math.min(100, Math.max(0, Number(data.swap) || 0))
      const disk = Math.min(100, Math.max(0, Number(data.disk) || 0))
      const rx_kbs = Number(data.rx_kbs) || 0
      const tx_kbs = Number(data.tx_kbs) || 0
      const ping = Number(data.ping) || 0

      if (cpu > 85 || ram > 90) {
        return {
          animPrefix: 'panic',
          banner: '🚨 EM PÂNICO! 🚨',
          color: COLOR_PANIC,
          cpu, ram, swap, disk, rx_kbs, tx_kbs, ping,
          uptime: data.uptime || '--',
          ram_mb: data.ram_mb || '--',
          top: data.top || '--'
        }
      }

      if (cpu < 40 && ram < 70) {
        return {
          animPrefix: 'zen',
          banner: '☕ MODO ZEN ☕',
          color: COLOR_ZEN,
          cpu, ram, swap, disk, rx_kbs, tx_kbs, ping,
          uptime: data.uptime || '--',
          ram_mb: data.ram_mb || '--',
          top: data.top || '--'
        }
      }

      return {
        animPrefix: 'work',
        banner: '⚡ TRABALHANDO ⚡',
        color: COLOR_WORKING,
        cpu, ram, swap, disk, rx_kbs, tx_kbs, ping,
        uptime: data.uptime || '--',
        ram_mb: data.ram_mb || '--',
        top: data.top || '--'
      }
    },

    updateUI(st) {
      this.state.currentAnimPrefix = st.animPrefix

      // 1. Arco Esquerdo (CPU: 140° a 220° -> 80° range)
      const cpuEndAngle = 140 + Math.max(2, Math.round((st.cpu / 100) * 80))
      const cpuColor = st.cpu > 85 ? COLOR_PANIC : (st.cpu >= 40 ? COLOR_WORKING : COLOR_ZEN)
      this.state.cpuArcWidget.setProperty(prop.MORE, {
        start_angle: 140,
        end_angle: cpuEndAngle,
        color: cpuColor
      })

      // 2. Arco Superior Direito (RAM: 318° a 356° -> 38° range)
      const ramEndAngle = 318 + Math.max(2, Math.round((st.ram / 100) * 38))
      const ramColor = st.ram > 90 ? COLOR_PANIC : (st.ram >= 70 ? COLOR_WORKING : COLOR_ZEN)
      this.state.ramArcWidget.setProperty(prop.MORE, {
        start_angle: 318,
        end_angle: ramEndAngle,
        color: ramColor
      })

      // 3. Arco Inferior Direito (SWAP: 4° a 42° -> 38° range)
      const swapEndAngle = 4 + Math.max(2, Math.round((st.swap / 100) * 38))
      this.state.swapArcWidget.setProperty(prop.MORE, {
        start_angle: 4,
        end_angle: swapEndAngle,
        color: COLOR_SWAP
      })

      // 4. Textos Laterais
      this.state.cpuSideText.setProperty(prop.MORE, {
        text: `CPU\n${st.cpu}%`,
        color: cpuColor
      })
      this.state.ramSideText.setProperty(prop.MORE, {
        text: `RAM\n${st.ram}%`,
        color: ramColor
      })
      this.state.swapSideText.setProperty(prop.MORE, {
        text: `SWP\n${st.swap}%`,
        color: COLOR_SWAP
      })

      // 5. Topo Limpo: LIVE + Uptime (Linha 1) e Ping + Rede KB/s (Linha 2)
      this.state.heartbeatToggle = !this.state.heartbeatToggle
      const liveDot = this.state.heartbeatToggle ? '● LIVE' : '○ LIVE'
      this.state.uptimeTextWidget.setProperty(prop.MORE, {
        text: `${liveDot}  •  UP ${st.uptime}`,
        color: st.color
      })

      this.state.netPingTextWidget.setProperty(prop.MORE, {
        text: `PING ${st.ping}ms  •  ↓${st.rx_kbs} ↑${st.tx_kbs} KB/s`
      })

      // 6. Painel Inferior
      this.state.stateBannerWidget.setProperty(prop.MORE, {
        text: st.banner,
        color: st.color
      })

      this.state.primaryMetricsWidget.setProperty(prop.MORE, {
        text: `RAM: ${st.ram_mb}  •  DISK: ${st.disk}%`
      })

      this.state.topProcTextWidget.setProperty(prop.MORE, {
        text: `🔥 TOP: ${st.top}`
      })
    },

    fetchServerStatus() {
      if (this.state.isLoading) return
      this.state.isLoading = true

      this.request({
        method: 'GET_OCI_HEALTH'
      })
        .then((data) => {
          const petState = this.evaluatePetState(data)
          this.updateUI(petState)
        })
        .catch(() => {
          const deadState = this.evaluatePetState({ status: 'offline' })
          this.updateUI(deadState)
        })
        .finally(() => {
          this.state.isLoading = false
        })
    },

    onDestroy() {
      if (this.state.animTimer) clearInterval(this.state.animTimer)
      if (this.state.pollTimer) clearInterval(this.state.pollTimer)
    }
  })
)
