#!/bin/bash
# College Baseball Pitcher Tracker Launcher
# Double-click this file to launch the app

cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}⚾ College Baseball Pitcher Tracker Launcher${NC}"
echo "============================================="

# Check if server is already running on port 8071
if lsof -Pi :8071 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✓ Server already running on port 8071${NC}"
else
    echo "Starting server..."
    # Start server in background, redirect output to log file
    nohup node server.mjs > /tmp/cbb_server.log 2>&1 &
    SERVER_PID=$!
    
    # Save PID for easy stopping later
    echo $SERVER_PID > /tmp/cbb_server.pid
    
    # Wait a moment for server to start
    sleep 3
    
    # Verify it started
    if lsof -Pi :8071 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${GREEN}✓ Server started successfully (PID: $SERVER_PID)${NC}"
    else
        echo -e "${RED}❌ Failed to start server${NC}"
        echo "Check log: /tmp/cbb_server.log"
        exit 1
    fi
fi

# Open in default browser
echo "Opening browser..."
open "http://localhost:8071"

echo -e "${GREEN}✓ Launch complete!${NC}"
echo ""
echo "Your College Baseball Pitcher Tracker is now running."
echo "To stop the server, run: ./stop_server.command"
echo ""

# Keep terminal open for a moment so user can see messages
sleep 2
