#!/bin/bash
# ─────────────────────────────────────────────
#  start-erp.sh  —  JBS Knit Wear ERP Launcher
#  Starts N8N + Ngrok with your static domain.
#  Usage:  bash start-erp.sh
# ─────────────────────────────────────────────

echo ""
echo "🚀 Starting Fluxora ERP Services..."
echo "──────────────────────────────────────"

# ── 1. Kill any stale processes on these ports ──
echo "→ Clearing ports 5678..."
lsof -ti:5678 | xargs kill -9 2>/dev/null || true

# ── 2. Start N8N in background ──
echo "→ Starting N8N on port 5678..."
N8N_SECURE_COOKIE=false npx n8n start &
N8N_PID=$!
echo "  N8N PID: $N8N_PID"

# ── 3. Wait for N8N to be ready ──
echo "→ Waiting for N8N to initialise..."
for i in {1..15}; do
  if curl -s http://localhost:5678/healthz > /dev/null 2>&1; then
    echo "  ✅ N8N is up!"
    break
  fi
  sleep 2
done

# ── 4. Start Ngrok with static domain ──
# Get your free static domain at: dashboard.ngrok.com → Domains
NGROK_DOMAIN="jbs-knit-wear.ngrok-free.app"   # ← replace with your actual domain

echo ""
echo "→ Starting Ngrok tunnel..."
echo "  Domain: https://${NGROK_DOMAIN}"
ngrok http --domain="${NGROK_DOMAIN}" 5678 &
NGROK_PID=$!
echo "  Ngrok PID: $NGROK_PID"

sleep 3

echo ""
echo "══════════════════════════════════════"
echo "  ✅ All services running!"
echo ""
echo "  N8N local:   http://localhost:5678"
echo "  N8N public:  https://${NGROK_DOMAIN}"
echo "══════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

# Keep script alive — kill children on exit
trap "kill $N8N_PID $NGROK_PID 2>/dev/null; echo 'Services stopped.'" EXIT
wait
