#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

echo "--> [1/6] Garantindo pacotes Python e Pillow na VM..."
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv python3-pil curl

echo "--> [2/6] Atualizando Agente Python OCI (Gunicorn + Systemd não-root em 127.0.0.1:8080)..."
if ! id -u oci-agent >/dev/null 2>&1; then
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin oci-agent
fi

sudo mkdir -p /opt/oci-tamagotchi-agent
if [ ! -d /opt/oci-tamagotchi-agent/venv ]; then
    sudo python3 -m venv /opt/oci-tamagotchi-agent/venv
fi
sudo /opt/oci-tamagotchi-agent/venv/bin/pip install -q flask psutil gunicorn

sudo cp ~/sysadmin-pet/oci-agent/oci_agent.py /opt/oci-tamagotchi-agent/oci_agent.py
sudo chown -R oci-agent:oci-agent /opt/oci-tamagotchi-agent

cat << SVCEOF | sudo tee /etc/systemd/system/oci-tamagotchi.service > /dev/null
[Unit]
Description=Lightweight OCI Telemetry Agent (SysAdmin Pet)
After=network.target

[Service]
User=oci-agent
Group=oci-agent
WorkingDirectory=/opt/oci-tamagotchi-agent
Environment="SYSADMIN_PET_API_KEY=${SYSADMIN_PET_API_KEY:-}"
ExecStart=/opt/oci-tamagotchi-agent/venv/bin/gunicorn --workers 1 --threads 2 --bind 127.0.0.1:8080 oci_agent:app
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable oci-tamagotchi.service
sudo systemctl restart oci-tamagotchi.service

echo "--> [3/6] Aplicando hardening (fechando 8080 externa) e integrando /health e /metrics ao Nginx (Porta 80)..."
sudo iptables -D INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || true
if [ -d /etc/iptables ]; then
    sudo sh -c "iptables-save > /etc/iptables/rules.v4" || true
fi

sudo bash -c 'cat > /etc/nginx/sites-available/default <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location = /health {
        proxy_pass http://127.0.0.1:8080/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location = /metrics {
        proxy_pass http://127.0.0.1:8080/metrics;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF'
sudo nginx -t && (sudo systemctl reload nginx || sudo systemctl restart nginx)

echo "--> [4/6] Instalando dependencias do Mini Program Zepp OS (@zeppos/zml)..."
if ! command -v zeus >/dev/null 2>&1; then
    sudo npm install -g @zeppos/zeus-cli
fi

cd ~/sysadmin-pet
npm install --no-audit --no-fund

echo "--> [5/6] Gerando 24 Sprites Animados (Cyber-Bot Tamagotchi) para o Amazfit T-Rex 3..."
rm -rf ~/sysadmin-pet/assets/raw ~/sysadmin-pet/assets/trex3 ~/sysadmin-pet/assets/trex3.r
mkdir -p ~/sysadmin-pet/assets/trex3.r
python3 - << 'IMGPY'
from PIL import Image, ImageDraw
import math

SIZE = 180

def generate_frames():
    # 1. MODO ZEN (6 frames: flutuando suave, piscando, caneca de café fumegante + partículas verdes)
    bob_offsets = [0, -4, -7, -4, 0, 3]
    for f in range(6):
        img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        dy = bob_offsets[f]

        # Sombra/Aura energética na base
        aura_w = 50 - dy * 2
        d.ellipse([90 - aura_w, 160, 90 + aura_w, 172], fill=(16, 185, 129, 70))

        # Antena com orbe pulsante
        d.line([90, 22 + dy, 90, 42 + dy], fill=(148, 163, 184, 255), width=4)
        orb_r = 7 if f % 2 == 0 else 5
        d.ellipse([90 - orb_r, 18 + dy - orb_r, 90 + orb_r, 18 + dy + orb_r], fill=(16, 185, 129, 255))

        # Orelhas / Conectores laterais
        d.rounded_rectangle([24, 72 + dy, 38, 106 + dy], radius=5, fill=(71, 85, 105, 255))
        d.rounded_rectangle([142, 72 + dy, 156, 106 + dy], radius=5, fill=(71, 85, 105, 255))

        # Corpo / Cabeça Cyber-Bot
        d.rounded_rectangle([34, 42 + dy, 146, 142 + dy], radius=26, fill=(30, 41, 59, 255), outline=(16, 185, 129, 255), width=4)
        # Tela OLED do rosto
        d.rounded_rectangle([46, 56 + dy, 134, 126 + dy], radius=16, fill=(15, 23, 42, 255))

        # Olhos LED Verdes (pisca no frame 3)
        if f == 3:
            d.line([58, 82 + dy, 80, 82 + dy], fill=(16, 185, 129, 255), width=5)
            d.line([100, 82 + dy, 122, 82 + dy], fill=(16, 185, 129, 255), width=5)
        else:
            d.arc([58, 70 + dy, 82, 94 + dy], start=180, end=360, fill=(16, 185, 129, 255), width=5)
            d.arc([98, 70 + dy, 122, 94 + dy], start=180, end=360, fill=(16, 185, 129, 255), width=5)

        # Sorriso LED
        d.arc([72, 92 + dy, 108, 116 + dy], start=10, end=170, fill=(16, 185, 129, 255), width=4)

        # Caneca de café na mão direita + fumaça subindo
        mug_y = 118 + dy
        d.rounded_rectangle([136, mug_y, 164, mug_y + 30], radius=4, fill=(245, 158, 11, 255), outline=(255, 255, 255, 255), width=2)
        d.arc([158, mug_y + 5, 172, mug_y + 24], start=270, end=90, fill=(255, 255, 255, 255), width=3)
        # Fumaça animada
        steam_y = mug_y - 6 - (f * 3)
        d.ellipse([144, steam_y, 152, steam_y + 8], fill=(255, 255, 255, 160))
        d.ellipse([152, steam_y - 8, 158, steam_y - 2], fill=(255, 255, 255, 110))

        # Partículas flutuantes
        py = 45 - (f * 5) % 30
        d.ellipse([18, py, 24, py + 6], fill=(16, 185, 129, 200))

        img.save(f'assets/trex3.r/zen_{f}.png')

    # 2. TRABALHANDO (6 frames: digitando rápido no notebook, código subindo, gota de suor)
    for f in range(6):
        img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        dy = -2 if f % 2 == 0 else 1

        # Antena Âmbar
        d.line([90, 18 + dy, 90, 36 + dy], fill=(148, 163, 184, 255), width=4)
        d.ellipse([84, 10 + dy, 96, 22 + dy], fill=(245, 158, 11, 255))

        # Cabeça Cyber-Bot
        d.rounded_rectangle([34, 36 + dy, 146, 130 + dy], radius=24, fill=(30, 41, 59, 255), outline=(245, 158, 11, 255), width=4)
        d.rounded_rectangle([46, 48 + dy, 134, 116 + dy], radius=14, fill=(15, 23, 42, 255))

        # Olhos focados (óculos hacker)
        d.rectangle([54, 66 + dy, 84, 82 + dy], fill=(245, 158, 11, 255))
        d.rectangle([96, 66 + dy, 126, 82 + dy], fill=(245, 158, 11, 255))
        d.line([84, 72 + dy, 96, 72 + dy], fill=(245, 158, 11, 255), width=3)

        # Boca concentrada
        d.line([74, 98 + dy, 106, 98 + dy], fill=(245, 158, 11, 255), width=4)

        # Gota de suor animada descendo na têmpora
        sweat_y = 48 + (f * 6)
        d.ellipse([132, sweat_y, 142, sweat_y + 14], fill=(56, 189, 248, 255))

        # Mãos alternando digitação rápida
        left_hand_y = 126 if f % 2 == 0 else 136
        right_hand_y = 136 if f % 2 == 0 else 126
        d.ellipse([42, left_hand_y, 64, left_hand_y + 18], fill=(245, 158, 11, 255))
        d.ellipse([116, right_hand_y, 138, right_hand_y + 18], fill=(245, 158, 11, 255))

        # Mini Laptop / Terminal Server na frente
        d.rounded_rectangle([48, 132, 132, 168], radius=6, fill=(51, 65, 85, 255), outline=(255, 255, 255, 220), width=2)
        # Linhas de código piscando na tampa
        code_w = 20 + (f * 9) % 45
        d.line([60, 144, 60 + code_w, 144], fill=(16, 185, 129, 255), width=3)
        d.line([60, 154, 115 - (f * 6) % 35, 154], fill=(245, 158, 11, 255), width=3)

        img.save(f'assets/trex3.r/work_{f}.png')

    # 3. PÂNICO (6 frames: tremendo para os lados, chamas animadas, sirene vermelha/amarela girando)
    shake_x = [-6, 6, -5, 5, -7, 7]
    for f in range(6):
        img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        dx = shake_x[f]

        # Chamas de fogo animadas na base
        for i, fx in enumerate([35, 65, 95, 125, 145]):
            flame_h = 25 + ((f + i) % 3) * 14
            d.polygon([
                (fx - 18, 172),
                (fx, 172 - flame_h),
                (fx + 18, 172)
            ], fill=(239, 68, 68, 230) if (f + i) % 2 == 0 else (245, 158, 11, 230))

        # Sirene de emergência no topo piscando
        siren_color = (239, 68, 68, 255) if f % 2 == 0 else (250, 204, 21, 255)
        d.rounded_rectangle([74 + dx, 14, 106 + dx, 38], radius=8, fill=siren_color, outline=(255, 255, 255, 255), width=2)
        if f % 2 == 0:
            # Raios de luz da sirene
            d.line([45 + dx, 10, 68 + dx, 22], fill=(250, 204, 21, 255), width=4)
            d.line([135 + dx, 10, 112 + dx, 22], fill=(250, 204, 21, 255), width=4)

        # Cabeça Cyber-Bot em Alerta Vermelho
        d.rounded_rectangle([34 + dx, 38, 146 + dx, 140], radius=24, fill=(69, 10, 10, 255), outline=(239, 68, 68, 255), width=4)
        d.rounded_rectangle([46 + dx, 50, 134 + dx, 126], radius=14, fill=(15, 23, 42, 255))

        # Olhos arregalados em pânico
        d.ellipse([54 + dx, 58, 84 + dx, 88], fill=(255, 255, 255, 255), outline=(239, 68, 68, 255), width=3)
        d.ellipse([65 + dx, 69, 73 + dx, 77], fill=(0, 0, 0, 255))
        d.ellipse([96 + dx, 58, 126 + dx, 88], fill=(255, 255, 255, 255), outline=(239, 68, 68, 255), width=3)
        d.ellipse([107 + dx, 69, 115 + dx, 77], fill=(0, 0, 0, 255))

        # Boca gritando
        mouth_h = 26 if f % 2 == 0 else 20
        d.rounded_rectangle([72 + dx, 94, 108 + dx, 94 + mouth_h], radius=10, fill=(239, 68, 68, 255))

        img.save(f'assets/trex3.r/panic_{f}.png')

    # 4. MORTO / OFFLINE (6 frames: robô desligado com olhos X + fantasminha subindo)
    for f in range(6):
        img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        # Corpo desligado na parte inferior
        d.rounded_rectangle([38, 72, 142, 158], radius=22, fill=(30, 41, 59, 255), outline=(100, 116, 139, 255), width=3)
        d.rounded_rectangle([48, 84, 132, 146], radius=12, fill=(15, 23, 42, 255))

        # Olhos em X (piscando vermelho escuro/cinza)
        x_col = (239, 68, 68, 255) if f % 2 == 0 else (148, 163, 184, 255)
        d.line([58, 94, 78, 114], fill=x_col, width=4)
        d.line([78, 94, 58, 114], fill=x_col, width=4)
        d.line([102, 94, 122, 114], fill=x_col, width=4)
        d.line([122, 94, 102, 114], fill=x_col, width=4)

        # Boca triste
        d.arc([72, 124, 108, 144], start=190, end=350, fill=(148, 163, 184, 255), width=4)

        # Fantasminha subindo e balançando para os lados
        gx = 90 + int(math.sin(f * 1.1) * 14)
        gy = 52 - (f * 6)
        d.ellipse([gx - 18, gy - 18, gx + 18, gy + 14], fill=(226, 232, 240, 210))
        d.rectangle([gx - 18, gy, gx + 18, gy + 20], fill=(226, 232, 240, 210))
        # Olhinhos do fantasma
        d.ellipse([gx - 9, gy - 6, gx - 3, gy], fill=(15, 23, 42, 255))
        d.ellipse([gx + 3, gy - 6, gx + 9, gy], fill=(15, 23, 42, 255))

        img.save(f'assets/trex3.r/dead_{f}.png')

    # Ícone oficial do app (248x248 sem avisos do compilador)
    icon = Image.open('assets/trex3.r/zen_0.png').resize((248, 248))
    icon.save('assets/trex3.r/icon.png')

generate_frames()
IMGPY

echo "--> [6/6] Testando build do pacote Zepp OS (zeus build)..."
zeus build

echo "=================================================================="
echo "✅ Deploy do SysAdmin Pet v2.0 (HUD Tatico + Animado) concluido!"
echo "Endpoint HTTP Publico (Porta 80): $(curl -s http://127.0.0.1/health)"
echo "=================================================================="
