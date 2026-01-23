#!/bin/bash
# 5-stop-all-trackers.sh
# Stop all running sports tracker servers

echo "🛑 Stopping All Sports Trackers"
echo "================================"
echo ""

# Function to stop a tracker
stop_tracker() {
    local name=$1
    local port=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "Stopping $name (port $port)..."
        lsof -ti:$port | xargs kill -9 2>/dev/null
        echo "  ✅ $name stopped"
    else
        echo "  ℹ️  $name not running"
    fi
}

# Stop each tracker
stop_tracker "NFL" 8071
stop_tracker "MLB" 8072
stop_tracker "CBB" 8073

echo ""
echo "✅ All trackers stopped"
