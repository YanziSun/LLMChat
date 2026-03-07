#!/bin/bash
# LLMChat dev launcher
# Usage: ./start.sh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.cargo/bin:$PATH"

# Kill any leftover process on port 5173
lsof -ti :5173 | xargs kill -9 2>/dev/null

cd "$PROJECT_DIR"

echo "[1/2] Starting Vite..."
npm run dev &
VITE_PID=$!

# Wait until Vite is ready
echo "Waiting for Vite to be ready..."
until curl -s http://localhost:5173 > /dev/null 2>&1; do
  sleep 0.5
done
echo "Vite ready."

echo "[2/2] Starting Tauri app..."
cd "$PROJECT_DIR/src-tauri"
cargo run --no-default-features

# When Tauri exits, also kill Vite
kill $VITE_PID 2>/dev/null
