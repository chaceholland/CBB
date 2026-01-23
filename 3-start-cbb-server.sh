#!/bin/bash
# 3-start-cbb-server.sh
# Start the College Baseball Pitcher Tracker server

cd /Users/chace/Desktop/CBB

echo "🚀 Starting College Baseball Pitcher Tracker"
echo "============================================"
echo ""
echo "Server: http://localhost:8073"
echo "Schedule: http://localhost:8073/schedule.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if port is already in use
if lsof -Pi :8073 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8073 is already in use!"
    echo ""
    read -p "Kill existing process and restart? (y/n): " kill_choice
    if [ "$kill_choice" = "y" ]; then
        echo "Killing existing process..."
        lsof -ti:8073 | xargs kill -9 2>/dev/null
        sleep 1
    else
        echo "Cancelled."
        exit 1
    fi
fi

echo "Starting server on port 8073..."
node server.mjs
