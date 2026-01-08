# CRHK Radio Proxy Server

Self-hosted HLS proxy for Commercial Radio Hong Kong streams with Playwright cookie extraction.

## Quick Deploy to VPS

### 1. Get a VPS (~$5/month)
- [DigitalOcean](https://digitalocean.com) - $6/month (1GB RAM)
- [Vultr](https://vultr.com) - $5/month (1GB RAM)
- [Hetzner](https://hetzner.com) - €4/month (2GB RAM) ← Best value
- [Linode](https://linode.com) - $5/month (1GB RAM)

Choose Ubuntu 22.04 or Debian 12.

### 2. SSH into your VPS
```bash
ssh root@YOUR_VPS_IP
```

### 3. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
```

### 4. Clone and deploy
```bash
git clone https://github.com/masstransitco/hki-zone.git
cd hki-zone/servers/radio-proxy
docker compose up -d --build
```

### 5. Verify
```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/radio/proxy?channel=903 | head
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/radio/stream?channel={881,903,864}` | Get stream info |
| `GET /api/radio/proxy?channel={channel}&path={path}` | Proxy HLS content |
| `POST /api/radio/refresh/{channel}` | Force refresh cookies |
| `POST /api/radio/prewarm` | Prewarm all channels |

## Connect Cloudflare Worker

Update the Worker's origin URL:
```typescript
const VERCEL_ORIGIN = "http://YOUR_VPS_IP:3001"
```

Or set up a domain with Cloudflare proxy for HTTPS.

## Systemd Service (Alternative to Docker)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
cd /opt/radio-proxy
npm install
npm run setup  # Install Playwright browsers
npm run build

# Create service
sudo tee /etc/systemd/system/radio-proxy.service << EOF
[Unit]
Description=CRHK Radio Proxy
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/radio-proxy
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable radio-proxy
sudo systemctl start radio-proxy
```

## Logs
```bash
# Docker
docker logs -f crhk-radio-proxy

# Systemd
journalctl -u radio-proxy -f
```
