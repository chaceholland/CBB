#!/bin/bash
# Stop the College Baseball Pitcher Tracker server

cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "🛑 Stopping College Baseball Pitcher Tracker Server"
echo "==================================================="

# Try to read PID from file
if [ -f /tmp/cbb_server.pid ]; then
    PID=$(cat /tmp/cbb_server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping server (PID: $PID)..."
        kill $PID
        sleep 1
        
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Server didn't stop gracefully, forcing...${NC}"
            kill -9 $PID
        fi
        
        rm /tmp/cbb_server.pid
        echo -e "${GREEN}✓ Server stopped${NC}"
    else
        echo -e "${YELLOW}Server not running (PID $PID not found)${NC}"
        rm /tmp/cbb_server.pid
    fi
else
    # Try to find it by port
    SERVER_PID=$(lsof -ti:8071)
    if [ ! -z "$SERVER_PID" ]; then
        echo "Found server on port 8071 (PID: $SERVER_PID)"
        kill $SERVER_PID
        sleep 1
        echo -e "${GREEN}✓ Server stopped${NC}"
    else
        echo -e "${YELLOW}No server found running on port 8071${NC}"
    fi
fi

echo ""
sleep 2
