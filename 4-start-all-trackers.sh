#!/bin/bash
# 4-start-all-trackers.sh
# Start all sports tracker servers (NFL, MLB, CBB)

echo "🚀 Starting All Sports Trackers"
echo "==============================="
echo ""
echo "This will start:"
echo "  • NFL Tracker (port 8071)"
echo "  • MLB Tracker (port 8072)"
echo "  • CBB Tracker (port 8073)"
echo ""

# Function to start a tracker
start_tracker() {
    local name=$1
    local port=$2
    local dir=$3
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "⚠️  $name already running on port $port"
    else
        echo "Starting $name on port $port..."
        cd "$dir"
        node server.mjs > "/tmp/${name,,}-tracker.log" 2>&1 &
        echo "  ✅ $name started (PID: $!)"
    fi
}

# Start each tracker
start_tracker "NFL" 8071 "/Users/chace/Desktop/NFL"
start_tracker "MLB" 8072 "/Users/chace/Desktop/MLB"
start_tracker "CBB" 8073 "/Users/chace/Desktop/CBB"

echo ""
echo "✅ All trackers started!"
echo ""
echo "Access URLs:"
echo "  NFL: http://localhost:8071/schedule.html"
echo "  MLB: http://localhost:8072/schedule.html"
echo "  CBB: http://localhost:8073/schedule.html"
echo ""
echo "To stop all trackers, run: 5-stop-all-trackers.sh"
echo "Or use: lsof -ti:8071,8072,8073 | xargs kill"
