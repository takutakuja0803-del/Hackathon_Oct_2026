#!/bin/bash
set -e
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
cd "$(dirname "$0")/frontend"
echo "=============================================="
echo "Starting Visualized GDB Web Application..."
echo "Open: http://localhost:5174"
echo "=============================================="
npm run dev
